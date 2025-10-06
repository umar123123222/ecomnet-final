import React, { useState, useRef, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Camera, X, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { BrowserMultiFormatReader } from '@zxing/browser';
import Tesseract from 'tesseract.js';
import { useToast } from '@/hooks/use-toast';

interface ScannedParcel {
  id: string;
  trackingId?: string;
  orderId?: string;
  timestamp: Date;
  status: 'success' | 'partial' | 'failed';
  rawText?: string;
}

interface ContinuousOCRScannerProps {
  onScanComplete: (parcels: ScannedParcel[]) => void;
  onClose: () => void;
}

const ContinuousOCRScanner: React.FC<ContinuousOCRScannerProps> = ({ onScanComplete, onClose }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [scanning, setScanning] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [scannedParcels, setScannedParcels] = useState<ScannedParcel[]>([]);
  const [cameraActive, setCameraActive] = useState(false);
  const [lastScanTime, setLastScanTime] = useState<number>(0);
  const { toast } = useToast();
  const codeReaderRef = useRef<BrowserMultiFormatReader | null>(null);
  const scanIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Improved regex patterns for tracking IDs and order IDs
  const patterns = {
    // Common courier tracking formats
    trackingId: [
      /TRK[A-Z0-9]{8,15}/gi,           // Generic tracking
      /[A-Z]{2}[0-9]{9}[A-Z]{2}/gi,    // International postal
      /[0-9]{10,20}/g,                  // Numeric tracking
      /LP[0-9]{9,12}/gi,                // Leopard
      /PX[0-9]{9,12}/gi,                // Postex
    ],
    // Order ID patterns
    orderId: [
      /ORD[0-9]{6,10}/gi,               // ORD prefix
      /#[0-9]{4,8}/g,                   // Hash prefix
      /ID[A-Z0-9]{6,10}/gi,             // ID prefix
      /[A-Z]{3}[0-9]{6,8}/gi,           // Three letter + numbers
    ],
  };

  useEffect(() => {
    startCamera();
    return () => {
      stopCamera();
    };
  }, []);

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'environment', // Use back camera
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
      });

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        setCameraActive(true);
        
        // Initialize barcode scanner
        codeReaderRef.current = new BrowserMultiFormatReader();
      }
    } catch (error) {
      console.error('Error accessing camera:', error);
      toast({
        title: 'Camera Error',
        description: 'Could not access camera. Please check permissions.',
        variant: 'destructive',
      });
    }
  };

  const stopCamera = () => {
    if (videoRef.current?.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
      videoRef.current.srcObject = null;
    }
    if (scanIntervalRef.current) {
      clearInterval(scanIntervalRef.current);
    }
    setCameraActive(false);
    setScanning(false);
  };

  const extractIds = (text: string): { trackingId?: string; orderId?: string } => {
    let trackingId: string | undefined;
    let orderId: string | undefined;

    // Try to find tracking ID
    for (const pattern of patterns.trackingId) {
      const match = text.match(pattern);
      if (match && match[0]) {
        trackingId = match[0].trim();
        break;
      }
    }

    // Try to find order ID
    for (const pattern of patterns.orderId) {
      const match = text.match(pattern);
      if (match && match[0]) {
        orderId = match[0].trim();
        break;
      }
    }

    return { trackingId, orderId };
  };

  const scanFrame = async () => {
    if (!videoRef.current || !canvasRef.current || processing) return;

    const now = Date.now();
    // Debounce: Only scan every 2 seconds to avoid duplicates
    if (now - lastScanTime < 2000) return;

    setProcessing(true);

    try {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const context = canvas.getContext('2d');

      if (!context) return;

      // Set canvas size to match video
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;

      // Draw current video frame to canvas
      context.drawImage(video, 0, 0, canvas.width, canvas.height);

      // Try barcode scanning first (faster)
      let barcodeResult: string | null = null;
      if (codeReaderRef.current) {
        try {
          const result = await codeReaderRef.current.decodeFromCanvas(canvas);
          if (result) {
            barcodeResult = result.getText();
          }
        } catch (e) {
          // No barcode found, will try OCR
        }
      }

      // Get image data for OCR
      const imageData = canvas.toDataURL('image/png');

      // Perform OCR
      const { data: { text } } = await Tesseract.recognize(imageData, 'eng', {
        logger: () => {}, // Disable logging for performance
      });

      // Combine barcode and OCR results
      const combinedText = `${barcodeResult || ''} ${text}`.toUpperCase();
      
      // Extract IDs
      const { trackingId, orderId } = extractIds(combinedText);

      // Only add if we found at least one ID
      if (trackingId || orderId) {
        const parcelId = `parcel_${Date.now()}`;
        
        // Check if this is a duplicate (same tracking or order ID recently scanned)
        const isDuplicate = scannedParcels.some(p => 
          (trackingId && p.trackingId === trackingId) ||
          (orderId && p.orderId === orderId)
        );

        if (!isDuplicate) {
          const newParcel: ScannedParcel = {
            id: parcelId,
            trackingId,
            orderId,
            timestamp: new Date(),
            status: (trackingId && orderId) ? 'success' : 'partial',
            rawText: combinedText.substring(0, 200), // Store snippet for debugging
          };

          setScannedParcels(prev => [...prev, newParcel]);
          setLastScanTime(now);

          // Visual and audio feedback
          toast({
            title: 'Parcel Scanned',
            description: `${trackingId ? `Tracking: ${trackingId}` : ''} ${orderId ? `Order: ${orderId}` : ''}`,
          });

          // Play beep sound (if available)
          try {
            const audio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBjiL0fPTgjMGHm7A7+OZWQ0PUqPo6qlpGgdBmN7zuHAbBzOF0PLVhzsJGmu57OWXVA0NV6jl7K9eFwlGnOH0vHIhBzSD0fPbhz0LGnC+7uuaXQ4PVqnm7bBhGgdBmN7zuHAbBzOF0PLVhzsJGmu57OWXVA0NV6jl7K9eFwlGnOH0vHIhBzSD0fPbhz0LGnC+7uuaXQ4PVqnm7bBhGgdBmN7zuHAbBzOF0PLVhzsJGmu57OWXVA0NV6jl7K9eFwlGnOH0vHIhBzSD0fPbhz0LGnC+7uuaXQ4PVqnm7bBhGgdBmN7zuHAbBzOF0PLVhzsJGmu57OWXVA0NV6jl7K9eFwlGnOH0vHIhBzSD0fPbhz0LGnC+7uuaXQ4PVqnm7bBhGgdBmN7zuHAbBzOF0PLVhzsJGmu57OWXVA0NV6jl7K9eFwlGnOH0vHIhBzSD0fPbhz0LGnC+7uuaXQ4PVqnm7bBhGgdBmN7zuHAbBzOF0PLVhzsJGmu57OWXVA0NV6jl7K9eFwlGnOH0vHIhBzSD0fPbhz0LGnC+7uuaXQ4PVqnm7bBhGgdBmN7zuHAbBzOF0PLVhzsJGmu57OWXVA0NV6jl7K9eFwlGnOH0vHIhBzSD0fPbhz0LGnC+7uuaXQ4PVqnm7bBhGgdBmN7zuHAbBzOF0PLVhzsJGmu57OWXVA0NV6jl7K9eFwlGnOH0vHIhBzSD0fPbhz0LGnC+7uuaXQ4PVqnm7bBhGgdBmN7zuHAbBzOF0PLVhzsJGmu57OWXVA0NV6jl7K9eFwlGnOH0vHIhBzSD0fPbhz0LGnC+7uuaXQ4PVqnm7bBhGgdBmN7zuHAbBzOF0PLVhzsJGmu57OWXVA0NV6jl7K9eFwlGnOH0vHIhBzSD0fPbhz0LGnC+7uuaXQ4PVqnm7bBhGg==');
            audio.play().catch(() => {});
          } catch (e) {
            // Audio not supported, ignore
          }
        }
      }
    } catch (error) {
      console.error('Error scanning frame:', error);
    } finally {
      setProcessing(false);
    }
  };

  const startScanning = () => {
    setScanning(true);
    // Scan every 1 second
    scanIntervalRef.current = setInterval(scanFrame, 1000);
  };

  const stopScanning = () => {
    setScanning(false);
    if (scanIntervalRef.current) {
      clearInterval(scanIntervalRef.current);
      scanIntervalRef.current = null;
    }
  };

  const handleRemoveParcel = (parcelId: string) => {
    setScannedParcels(prev => prev.filter(p => p.id !== parcelId));
  };

  const handleComplete = () => {
    onScanComplete(scannedParcels);
    stopCamera();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black">
      {/* Camera View */}
      <div className="relative w-full h-full">
        <video
          ref={videoRef}
          className="w-full h-full object-cover"
          playsInline
          muted
        />
        <canvas ref={canvasRef} className="hidden" />

        {/* Scanning indicator overlay */}
        {scanning && (
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
              <div className="w-64 h-64 border-4 border-green-500 rounded-lg animate-pulse" />
            </div>
          </div>
        )}

        {/* Top Controls */}
        <div className="absolute top-0 left-0 right-0 p-4 bg-gradient-to-b from-black/70 to-transparent">
          <div className="flex items-center justify-between">
            <h2 className="text-white text-xl font-bold">Scan Returns ({scannedParcels.length})</h2>
            <Button variant="ghost" size="icon" onClick={() => { stopCamera(); onClose(); }}>
              <X className="h-6 w-6 text-white" />
            </Button>
          </div>
          {processing && (
            <div className="flex items-center gap-2 mt-2 text-white">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="text-sm">Processing...</span>
            </div>
          )}
        </div>

        {/* Scanned Parcels List */}
        <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/90 to-transparent max-h-1/2 overflow-y-auto">
          <div className="space-y-2 mb-20">
            {scannedParcels.map((parcel) => (
              <Card key={parcel.id} className="bg-white/95">
                <CardContent className="p-3 flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      {parcel.status === 'success' ? (
                        <CheckCircle className="h-4 w-4 text-green-600" />
                      ) : (
                        <AlertCircle className="h-4 w-4 text-yellow-600" />
                      )}
                      <div className="text-sm">
                        {parcel.trackingId && (
                          <p className="font-semibold">Tracking: {parcel.trackingId}</p>
                        )}
                        {parcel.orderId && (
                          <p className="text-gray-600">Order: {parcel.orderId}</p>
                        )}
                        <p className="text-xs text-gray-400">
                          {parcel.timestamp.toLocaleTimeString()}
                        </p>
                      </div>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleRemoveParcel(parcel.id)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* Bottom Action Buttons */}
        <div className="absolute bottom-0 left-0 right-0 p-4 flex gap-2">
          {!scanning ? (
            <Button
              onClick={startScanning}
              disabled={!cameraActive}
              className="flex-1 h-14 text-lg bg-green-600 hover:bg-green-700"
            >
              <Camera className="h-6 w-6 mr-2" />
              Start Scanning
            </Button>
          ) : (
            <Button
              onClick={stopScanning}
              className="flex-1 h-14 text-lg bg-red-600 hover:bg-red-700"
            >
              Pause Scanning
            </Button>
          )}
          <Button
            onClick={handleComplete}
            disabled={scannedParcels.length === 0}
            className="flex-1 h-14 text-lg bg-blue-600 hover:bg-blue-700"
          >
            Complete ({scannedParcels.length})
          </Button>
        </div>
      </div>
    </div>
  );
};

export default ContinuousOCRScanner;
