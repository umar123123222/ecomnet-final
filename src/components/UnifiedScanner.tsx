import React, { useState, useEffect, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Label } from '@/components/ui/label';
import { useHandheldScanner } from '@/contexts/HandheldScannerContext';
import { BrowserMultiFormatReader } from '@zxing/browser';
import { useToast } from '@/hooks/use-toast';
import { Camera, Type, Keyboard, ScanLine } from 'lucide-react';
import Tesseract from 'tesseract.js';

export interface ScanResult {
  orderId?: string;
  trackingId?: string;
  rawData: string;
  method: 'handheld' | 'barcode' | 'ocr' | 'manual';
  confidence: number;
  timestamp: Date;
  scanDuration: number;
}

interface UnifiedScannerProps {
  isOpen: boolean;
  onClose: () => void;
  onScan: (result: ScanResult) => void;
  scanType: 'dispatch' | 'return' | 'receiving';
  title?: string;
}

const UnifiedScanner: React.FC<UnifiedScannerProps> = ({
  isOpen,
  onClose,
  onScan,
  scanType,
  title = 'Scan Package',
}) => {
  const [currentMethod, setCurrentMethod] = useState<'handheld' | 'barcode' | 'ocr' | 'manual'>('barcode');
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [manualEntry, setManualEntry] = useState({ trackingId: '', orderId: '' });
  const [scanStartTime, setScanStartTime] = useState<number>(0);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const codeReaderRef = useRef<BrowserMultiFormatReader | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const videoStreamRef = useRef<MediaStream | null>(null);
  
  const { isConnected: handheldConnected, onScan: onHandheldScan } = useHandheldScanner();
  const { toast } = useToast();

  // Extract order/tracking ID from text
  const extractIds = (text: string): { orderId?: string; trackingId?: string } => {
    const patterns = {
      trackingId: [
        /(?:tracking|track|awb)[\s:#-]*([A-Z0-9]{8,20})/i,
        /\b([A-Z]{2,3}\d{8,15})\b/,
        /\b(\d{10,20})\b/,
      ],
      orderId: [
        /(?:order|ord|po)[\s:#-]*([A-Z0-9]{6,15})/i,
        /#(\d{4,10})/,
      ],
    };

    let trackingId: string | undefined;
    let orderId: string | undefined;

    for (const pattern of patterns.trackingId) {
      const match = text.match(pattern);
      if (match) {
        trackingId = match[1];
        break;
      }
    }

    for (const pattern of patterns.orderId) {
      const match = text.match(pattern);
      if (match) {
        orderId = match[1];
        break;
      }
    }

    return { trackingId, orderId };
  };

  // Helper to stop camera stream
  const stopCamera = () => {
    if (videoStreamRef.current) {
      videoStreamRef.current.getTracks().forEach(track => track.stop());
      videoStreamRef.current = null;
    }
    if (videoRef.current && videoRef.current.srcObject) {
      videoRef.current.srcObject = null;
    }
  };

  const emitResult = (result: Partial<ScanResult>) => {
    const scanDuration = Date.now() - scanStartTime;
    const fullResult: ScanResult = {
      orderId: result.orderId,
      trackingId: result.trackingId,
      rawData: result.rawData || '',
      method: result.method || 'manual',
      confidence: result.confidence || 100,
      timestamp: new Date(),
      scanDuration,
    };

    stopCamera();
    onScan(fullResult);
    toast({
      title: 'Scan Successful',
      description: `${result.method} scan completed in ${(scanDuration / 1000).toFixed(1)}s`,
    });
    onClose();
  };

  // Method switch helper
  const switchToMethod = (method: 'barcode' | 'ocr' | 'manual') => {
    stopCamera();
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    setCurrentMethod(method);
    setProgress(0);
    setIsProcessing(false);
  };

  // Step 1: Try Handheld Scanner
  useEffect(() => {
    if (!isOpen || !handheldConnected || currentMethod !== 'handheld') return;

    setIsProcessing(true);
    setProgress(10);

    const cleanup = onHandheldScan((data) => {
      const { trackingId, orderId } = extractIds(data);
      emitResult({
        trackingId,
        orderId,
        rawData: data,
        method: 'handheld',
        confidence: 100,
      });
    });

    // Short timeout before moving to camera barcode
    timeoutRef.current = setTimeout(() => {
      if (currentMethod === 'handheld') {
        setCurrentMethod('barcode');
      }
    }, 500);

    return cleanup;
  }, [isOpen, handheldConnected, currentMethod]);

  // Step 2: Camera Barcode Scanning
  useEffect(() => {
    if (!isOpen || currentMethod !== 'barcode') return;

    let isScanning = true;
    setIsProcessing(true);
    setProgress(30);

    const startBarcodeScanning = async () => {
      try {
        const codeReader = new BrowserMultiFormatReader();
        codeReaderRef.current = codeReader;

        const videoInputDevices = await BrowserMultiFormatReader.listVideoInputDevices();
        const backCamera = videoInputDevices.find(device => 
          device.label.toLowerCase().includes('back')
        ) || videoInputDevices[0];

        if (!videoRef.current) return;

        const stream = await navigator.mediaDevices.getUserMedia({
          video: { deviceId: backCamera?.deviceId, facingMode: 'environment' }
        });
        videoStreamRef.current = stream;

        codeReader.decodeFromVideoDevice(
          backCamera?.deviceId,
          videoRef.current,
          (result, error) => {
            if (result && isScanning) {
              const text = result.getText();
              const { trackingId, orderId } = extractIds(text);
              
              emitResult({
                trackingId,
                orderId,
                rawData: text,
                method: 'barcode',
                confidence: 95,
              });
            }
          }
        );

        setProgress(50);

        // Extended timeout - 5 seconds for barcode detection
        timeoutRef.current = setTimeout(() => {
          if (isScanning && currentMethod === 'barcode') {
            toast({
              title: 'No Barcode Detected',
              description: 'Try holding the barcode steady, or use OCR/Manual entry',
              variant: 'default',
            });
          }
        }, 5000);

      } catch (error) {
        console.error('Barcode scanning error:', error);
        toast({
          title: 'Camera Error',
          description: 'Could not access camera. Please try manual entry.',
          variant: 'destructive',
        });
      }
    };

    startBarcodeScanning();

    return () => {
      isScanning = false;
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      stopCamera();
    };
  }, [isOpen, currentMethod]);

  // Step 3: OCR Scanning
  const handleOCRScan = async () => {
    if (!videoRef.current || !canvasRef.current) return;

    setIsProcessing(true);
    setProgress(80);

    try {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      
      const { data } = await Tesseract.recognize(canvas, 'eng', {
        logger: (m) => {
          if (m.status === 'recognizing text') {
            setProgress(80 + (m.progress * 20));
          }
        },
      });

      const { trackingId, orderId } = extractIds(data.text);

      if (trackingId || orderId) {
        emitResult({
          trackingId,
          orderId,
          rawData: data.text,
          method: 'ocr',
          confidence: data.confidence,
        });
      } else {
        toast({
          title: 'No IDs Found',
          description: 'Please try again or enter manually',
          variant: 'default',
        });
      }
    } catch (error) {
      console.error('OCR error:', error);
      toast({
        title: 'OCR Failed',
        description: 'Please try again or enter manually',
        variant: 'destructive',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  // Step 4: Manual Entry
  const handleManualSubmit = () => {
    if (!manualEntry.trackingId && !manualEntry.orderId) {
      toast({
        title: 'Invalid Entry',
        description: 'Please enter at least one ID',
        variant: 'destructive',
      });
      return;
    }

    emitResult({
      trackingId: manualEntry.trackingId,
      orderId: manualEntry.orderId,
      rawData: `${manualEntry.trackingId || ''} ${manualEntry.orderId || ''}`,
      method: 'manual',
      confidence: 100,
    });
  };

  useEffect(() => {
    if (isOpen) {
      setScanStartTime(Date.now());
      setProgress(0);
      setCurrentMethod(handheldConnected ? 'handheld' : 'barcode');
      setManualEntry({ trackingId: '', orderId: '' });
    }

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      stopCamera();
    };
  }, [isOpen, handheldConnected]);

  const getStatusMessage = () => {
    switch (currentMethod) {
      case 'handheld':
        return 'Waiting for handheld scanner input...';
      case 'barcode':
        return 'Hold barcode steady in the green frame';
      case 'ocr':
        return isProcessing ? 'Processing text recognition...' : 'Click "Use OCR" to capture and process text';
      case 'manual':
        return 'Enter tracking and order details manually';
      default:
        return '';
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            {getStatusMessage()}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Method Selector Buttons - Always Visible */}
          <div className="flex gap-2">
            <Button
              type="button"
              size="sm"
              variant={currentMethod === 'barcode' ? 'default' : 'outline'}
              onClick={() => switchToMethod('barcode')}
              className="flex-1"
            >
              <Camera className="h-4 w-4 mr-1" />
              Barcode
            </Button>
            <Button
              type="button"
              size="sm"
              variant={currentMethod === 'ocr' ? 'default' : 'outline'}
              onClick={() => handleOCRScan()}
              disabled={isProcessing || currentMethod === 'manual'}
              className="flex-1"
            >
              <ScanLine className="h-4 w-4 mr-1" />
              Use OCR
            </Button>
            <Button
              type="button"
              size="sm"
              variant={currentMethod === 'manual' ? 'default' : 'outline'}
              onClick={() => switchToMethod('manual')}
              className="flex-1"
            >
              <Keyboard className="h-4 w-4 mr-1" />
              Manual
            </Button>
          </div>

          {/* Progress Bar */}
          {isProcessing && (
            <div className="flex items-center gap-2">
              <Progress value={progress} className="flex-1" />
              <span className="text-xs text-muted-foreground">{progress}%</span>
            </div>
          )}

          {/* Video Preview */}
          {(currentMethod === 'barcode' || currentMethod === 'ocr') && (
            <div className="relative bg-black rounded-lg overflow-hidden aspect-video">
              <video ref={videoRef} className="w-full h-full object-cover" autoPlay playsInline muted />
              <canvas ref={canvasRef} className="hidden" />
              
              {/* ROI Overlay for Barcode */}
              {currentMethod === 'barcode' && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="border-2 border-green-500 w-3/4 h-2/3 rounded-lg shadow-lg" />
                  <div className="absolute bottom-4 text-white text-sm bg-black/60 px-3 py-1 rounded">
                    Hold barcode steady in green frame
                  </div>
                </div>
              )}

              {/* Processing Overlay */}
              {isProcessing && currentMethod === 'ocr' && (
                <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                  <div className="text-white text-sm">Processing text...</div>
                </div>
              )}
            </div>
          )}

          {/* Manual Entry Form */}
          {currentMethod === 'manual' && (
            <div className="space-y-4 p-4 border rounded-lg">
              <div>
                <Label htmlFor="trackingId">Tracking ID</Label>
                <Input
                  id="trackingId"
                  placeholder="Enter tracking ID"
                  value={manualEntry.trackingId}
                  onChange={(e) => setManualEntry(prev => ({ ...prev, trackingId: e.target.value }))}
                />
              </div>
              <div>
                <Label htmlFor="orderId">Order ID</Label>
                <Input
                  id="orderId"
                  placeholder="Enter order ID"
                  value={manualEntry.orderId}
                  onChange={(e) => setManualEntry(prev => ({ ...prev, orderId: e.target.value }))}
                />
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            
            {currentMethod === 'manual' && (
              <Button onClick={handleManualSubmit}>
                Submit
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default UnifiedScanner;