import React, { useRef, useEffect, useState } from 'react';
import { BrowserMultiFormatReader } from '@zxing/library';
import { createWorker } from 'tesseract.js';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Camera, CameraOff, Flashlight, RotateCcw, Type, QrCode, Loader2 } from 'lucide-react';

interface OCRScannerProps {
  isOpen: boolean;
  onClose: () => void;
  onScan: (data: { orderId?: string; trackingId?: string; rawData: string }) => void;
  title?: string;
  scanType: 'dispatch' | 'return';
}

type ScanMode = 'qr' | 'ocr';

const OCRScanner: React.FC<OCRScannerProps> = ({
  isOpen,
  onClose,
  onScan,
  title = "Scan Order",
  scanType
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const codeReader = useRef<BrowserMultiFormatReader | null>(null);
  const ocrWorker = useRef<any>(null);
  const scanIntervalRef = useRef<NodeJS.Timeout | null>(null);
  
  const [isScanning, setIsScanning] = useState(false);
  const [scanMode, setScanMode] = useState<ScanMode>('qr');
  const [error, setError] = useState<string | null>(null);
  const [detectedOrderId, setDetectedOrderId] = useState('');
  const [torchSupported, setTorchSupported] = useState(false);
  const [torchEnabled, setTorchEnabled] = useState(false);
  const [ocrProgress, setOcrProgress] = useState(0);
  const [scanAttempts, setScanAttempts] = useState(0);
  const [showManualCapture, setShowManualCapture] = useState(false);

  const { toast } = useToast();

  // Order ID extraction patterns (improved)
  const extractOrderId = (text: string): string | null => {
    // Normalize OCR quirks before matching
    const normalize = (s: string) => {
      let t = s
        .replace(/[\u2010-\u2015]/g, '-') // hyphen variants
        .replace(/[|]/g, 'I') // pipe to I
        .replace(/\s+/g, ' ') // collapse spaces
        .toUpperCase();
      // Common OCR confusions around "ORD"
      t = t.replace(/0RD/g, 'ORD'); // zero -> O
      t = t.replace(/ORDI/g, 'ORD1');
      return t;
    };

    const cleanText = normalize(text).replace(/[^A-Z0-9#:_\-\s]/g, ' ').trim();

    // Try several robust patterns
    const patterns: RegExp[] = [
      /(?:ORDER(?:\s*ID)?|ORD)[:\s#\-]*([A-Z0-9\-]{4,})/i, // ORDER ID: XYZ, ORD-12345
      /(?:ORD)[\s:_\-]*([0-9]{4,})/i,                      // ORD 12345, ORD-12345
      /#\s*([0-9]{4,})/i,                                   // #12345
      /([A-Z]{2,}[0-9]{4,})/i,                               // ORD123456, AB1234
    ];

    for (const pattern of patterns) {
      const m = cleanText.match(pattern);
      if (m) {
        let id = m[1] || m[0];
        id = id.replace(/[^A-Z0-9\-]/g, '');
        // If it looks like just digits and we saw an ORD prefix nearby, prefix it
        if (/^[0-9]{4,}$/.test(id) && /ORD[\s:_\-]*[0-9]{4,}/.test(cleanText)) {
          id = `ORD${id}`;
        }
        if (id.length >= 4) return id.toUpperCase();
      }
    }
    return null;
  };

  // Initialize OCR worker with proper lifecycle
  const initOCRWorker = async () => {
    try {
      if (!ocrWorker.current) {
        ocrWorker.current = await createWorker('eng', 1, {
          logger: (m: any) => {
            if (m.status === 'recognizing text') {
              setOcrProgress(Math.round(m.progress * 100));
            }
          }
        });
        await ocrWorker.current.setParameters({
          tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789#:-_',
          tessedit_pageseg_mode: '6', // Uniform block of text
          preserve_interword_spaces: '1',
          user_defined_dpi: '300'
        });
      }
    } catch (error) {
      console.error('OCR Worker initialization error:', error);
      setError('Failed to initialize OCR engine');
    }
  };

  const processOCRFrame = async () => {
    if (!videoRef.current || !canvasRef.current || !ocrWorker.current) return;

    try {
      const video = videoRef.current;
      
      // Guard: ensure video has valid dimensions
      if (video.videoWidth < 2 || video.videoHeight < 2) return;

      // Define a centered region of interest (ROI) where users place the text
      const roiW = Math.floor(video.videoWidth * 0.8);
      const roiH = Math.floor(video.videoHeight * 0.28);
      const roiX = Math.floor((video.videoWidth - roiW) / 2);
      const roiY = Math.floor((video.videoHeight - roiH) / 2);

      // Create an offscreen canvas and upscale a bit for better OCR
      const scale = 1.5;
      const roiCanvas = document.createElement('canvas');
      roiCanvas.width = Math.max(640, Math.floor(roiW * scale));
      roiCanvas.height = Math.max(200, Math.floor(roiH * scale));
      const rctx = roiCanvas.getContext('2d');
      if (!rctx) return;

      // Draw ROI from video to canvas with scaling
      rctx.drawImage(video, roiX, roiY, roiW, roiH, 0, 0, roiCanvas.width, roiCanvas.height);

      // Simple preprocessing: grayscale + mean threshold to increase contrast
      const imgData = rctx.getImageData(0, 0, roiCanvas.width, roiCanvas.height);
      const d = imgData.data;
      let sum = 0;
      for (let i = 0; i < d.length; i += 4) {
        const gray = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
        sum += gray;
      }
      const mean = sum / (d.length / 4);
      const threshold = mean * 0.9; // tweakable
      for (let i = 0; i < d.length; i += 4) {
        const gray = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
        const v = gray > threshold ? 255 : 0;
        d[i] = d[i + 1] = d[i + 2] = v;
      }
      rctx.putImageData(imgData, 0, 0);

      const imageData = roiCanvas.toDataURL('image/png');

      // OCR the ROI
      const { data: { text, confidence } } = await ocrWorker.current.recognize(imageData);

      // Only process if confidence is above threshold (reduces noise)
      if (text && confidence > 60) {
        const orderId = extractOrderId(text);
        if (orderId) {
          setDetectedOrderId(orderId);
          await handleOrderDetected(orderId, text);
        }
      }
      
      setScanAttempts(prev => prev + 1);
    } catch (error) {
      console.error('OCR processing error:', error);
    }
  };

  // Handle successful order detection
  const handleOrderDetected = async (orderId: string, rawData: string) => {
    try {
      // Save scan result to database
      const { data: userData } = await supabase.auth.getUser();
      if (userData?.user) {
        await supabase.from('scan_results').insert({
          scan_type: scanType,
          order_id: orderId,
          raw_data: rawData,
          scan_mode: scanMode === 'qr' ? 'barcode' : 'ocr',
          scanned_by: userData.user.id,
        });
      }

      // Provide audio feedback
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      oscillator.frequency.value = 800;
      oscillator.type = 'sine';
      gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
      
      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.3);

      // Show success toast
      toast({
        title: "Order ID Detected",
        description: `Found: ${orderId}`,
        duration: 2000,
      });

      // Call parent callback
      onScan({
        orderId,
        rawData
      });

      // Stop scanning
      stopScanning();
    } catch (error) {
      console.error('Error handling order detection:', error);
    }
  };

  // Start QR/Barcode scanning
  const startQRScanning = async () => {
    try {
      if (!codeReader.current) {
        codeReader.current = new BrowserMultiFormatReader();
      }

      const videoInputDevices = await codeReader.current.listVideoInputDevices();
      
      if (!videoInputDevices || videoInputDevices.length === 0) {
        setError('No camera found on this device');
        return;
      }

      let selectedDeviceId = videoInputDevices[0]?.deviceId;

      // Prefer back camera on mobile
      const backCamera = videoInputDevices.find(device => 
        device.label.toLowerCase().includes('back') || 
        device.label.toLowerCase().includes('rear') || 
        device.label.toLowerCase().includes('environment')
      );
      if (backCamera) {
        selectedDeviceId = backCamera.deviceId;
      }

      if (videoRef.current) {
        // Let zxing manage the camera stream directly - no manual waiting
        await codeReader.current.decodeFromVideoDevice(
          selectedDeviceId,
          videoRef.current,
          (result, error) => {
            if (result) {
              const scannedText = result.getText();
              const orderId = extractOrderId(scannedText);
              
              if (orderId) {
                handleOrderDetected(orderId, scannedText);
              } else {
                onScan({
                  rawData: scannedText
                });
                stopScanning();
              }
            }
            // Increment scan attempts for timeout detection
            if (!result && !error) {
              setScanAttempts(prev => prev + 1);
            }
            if (error && error.message && !error.message.includes('No MultiFormat Readers')) {
              console.error('QR scan error:', error);
            }
          }
        );

        // Check for torch support after stream is established
        setTimeout(() => {
          const track = videoRef.current?.srcObject && 
            (videoRef.current.srcObject as MediaStream).getVideoTracks()[0];
          if (track && 'getCapabilities' in track) {
            const capabilities = track.getCapabilities() as any;
            setTorchSupported(!!capabilities.torch);
          }
        }, 500);
      }
    } catch (error) {
      console.error('Error starting QR scanning:', error);
      setError('Failed to access camera. Please check permissions.');
    }
  };

  // Start OCR scanning
  const startOCRScanning = async () => {
    try {
      await initOCRWorker();
      
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1280 },
          height: { ideal: 720 }
        }
      });

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();

        // Wait for video metadata to be loaded before starting OCR
        await new Promise<void>((resolve) => {
          const v = videoRef.current;
          if (!v) return resolve();
          if (v.readyState >= 2 && v.videoWidth > 0) {
            return resolve();
          }
          v.onloadedmetadata = () => resolve();
        });

        // Check for torch support
        const track = stream.getVideoTracks()[0];
        if (track && 'getCapabilities' in track) {
          const capabilities = track.getCapabilities() as any;
          setTorchSupported(!!capabilities.torch);
        }

        // Start OCR processing at intervals after video is ready
        scanIntervalRef.current = setInterval(processOCRFrame, 1200);
      }
    } catch (error) {
      console.error('Error starting OCR scanning:', error);
      setError('Failed to access camera. Please check permissions.');
    }
  };

  // Start scanning based on mode
  const startScanning = async () => {
    setIsScanning(true);
    setError(null);
    setDetectedOrderId('');
    setOcrProgress(0);
    setScanAttempts(0);
    setShowManualCapture(false);

    if (scanMode === 'qr') {
      await startQRScanning();
    } else {
      await startOCRScanning();
    }
  };

  // Stop scanning
  const stopScanning = () => {
    setIsScanning(false);
    
    if (codeReader.current) {
      codeReader.current.reset();
    }

    if (scanIntervalRef.current) {
      clearInterval(scanIntervalRef.current);
      scanIntervalRef.current = null;
    }

    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
      videoRef.current.srcObject = null;
    }

    setTorchEnabled(false);
    setOcrProgress(0);
    setScanAttempts(0);
    setShowManualCapture(false);
  };

  // Toggle torch
  const toggleTorch = async () => {
    if (!videoRef.current || !torchSupported) return;

    try {
      const stream = videoRef.current.srcObject as MediaStream;
      const track = stream.getVideoTracks()[0];
      
      if (track && 'applyConstraints' in track) {
        await track.applyConstraints({
          advanced: [{ torch: !torchEnabled } as any]
        });
        setTorchEnabled(!torchEnabled);
      }
    } catch (error) {
      console.error('Error toggling torch:', error);
    }
  };

  // Handle dialog close
  const handleClose = () => {
    stopScanning();
    onClose();
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopScanning();
      if (ocrWorker.current) {
        ocrWorker.current.terminate();
        ocrWorker.current = null;
      }
    };
  }, []);

  // Auto-start scanning when dialog opens or mode changes
  useEffect(() => {
    if (isOpen) {
      // Stop current scanning if active
      if (isScanning) {
        stopScanning();
      }
      // Start scanning automatically after a brief delay
      const timer = setTimeout(() => {
        startScanning();
      }, 100);
      return () => clearTimeout(timer);
    } else if (isScanning) {
      stopScanning();
    }
  }, [isOpen, scanMode]);

  // Show manual capture button after 5 seconds of failed attempts
  useEffect(() => {
    if (isScanning && scanAttempts >= 4 && !showManualCapture) {
      setShowManualCapture(true);
    }
  }, [isScanning, scanAttempts, showManualCapture]);

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {scanMode === 'qr' ? <QrCode className="h-5 w-5" /> : <Type className="h-5 w-5" />}
              {title}
            </DialogTitle>
            <DialogDescription>
              Aim the camera at the printed Order ID inside the box. Good light helps. Works best over HTTPS.
            </DialogDescription>
          </DialogHeader>
        
        <div className="space-y-4">
          {/* Scan Mode Toggle */}
          <div className="flex gap-2">
            <Button
              variant={scanMode === 'qr' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setScanMode('qr')}
              className="flex-1"
            >
              <QrCode className="h-4 w-4 mr-2" />
              QR/Barcode
            </Button>
            <Button
              variant={scanMode === 'ocr' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setScanMode('ocr')}
              className="flex-1"
            >
              <Type className="h-4 w-4 mr-2" />
              Text (OCR)
            </Button>
          </div>

          {/* Camera Preview */}
          <div className="relative bg-black rounded-lg overflow-hidden aspect-video">
            <video
              ref={videoRef}
              className="w-full h-full object-cover"
              playsInline
              autoPlay
              muted
            />
            <canvas
              ref={canvasRef}
              className="hidden"
            />
            
            {/* Scanning overlay with mode-specific frames */}
              {isScanning && (
                <div className="absolute inset-0">
                  {scanMode === 'qr' ? (
                    // Square frame for QR codes
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="w-48 h-48 border-4 border-primary rounded-lg relative">
                        <div className="absolute top-2 left-2 w-6 h-6 border-t-4 border-l-4 border-white"></div>
                        <div className="absolute top-2 right-2 w-6 h-6 border-t-4 border-r-4 border-white"></div>
                        <div className="absolute bottom-2 left-2 w-6 h-6 border-b-4 border-l-4 border-white"></div>
                        <div className="absolute bottom-2 right-2 w-6 h-6 border-b-4 border-r-4 border-white"></div>
                      </div>
                      <div className="absolute top-4 left-0 right-0 text-center">
                        <div className="inline-block bg-black/70 text-white text-xs px-3 py-1 rounded-full">
                          Position QR code in center
                        </div>
                      </div>
                    </div>
                  ) : (
                    // Wider rectangular frame for text
                    <div className="absolute inset-0 border-2 border-primary/50">
                      <div className="absolute inset-x-4 top-1/3 h-24 border-2 border-white rounded">
                        <div className="absolute -top-6 left-2 text-white text-xs bg-black/70 px-2 py-1 rounded">
                          Position text clearly in this area
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* OCR Progress and Status */}
              {scanMode === 'ocr' && ocrProgress > 0 && (
                <div className="absolute bottom-2 left-2 right-2">
                  <div className="bg-black/70 text-white text-xs px-3 py-1.5 rounded-full text-center">
                    Scanning text: {ocrProgress}%
                  </div>
                </div>
              )}

              {/* QR Mode Status */}
              {scanMode === 'qr' && isScanning && (
                <div className="absolute bottom-2 left-2 right-2">
                  <div className="bg-black/70 text-white text-xs px-3 py-1.5 rounded-full text-center">
                    Looking for QR/Barcode...
                  </div>
                </div>
              )}

              {/* No detection timeout message */}
              {isScanning && scanAttempts >= 4 && !detectedOrderId && (
                <div className="absolute top-2 left-2 right-2">
                  <div className="bg-yellow-600/90 text-white text-xs px-3 py-1.5 rounded text-center">
                    {scanMode === 'qr' 
                      ? 'No QR code detected - try better lighting or switch to Text mode'
                      : 'No text detected - ensure good lighting and clear text'}
                  </div>
                </div>
              )}
          </div>

          {/* Detected Order ID */}
          {detectedOrderId && (
            <div className="space-y-2">
              <Label htmlFor="orderId">Detected Order ID</Label>
              <Input
                id="orderId"
                value={detectedOrderId}
                onChange={(e) => setDetectedOrderId(e.target.value)}
                placeholder="Order ID will appear here"
              />
            </div>
          )}

          {/* Status and Error */}
          {error && (
            <Badge variant="destructive" className="w-full justify-center">
              {error}
            </Badge>
          )}

          {/* Status Badge */}
          {isScanning && (
            <Badge className="w-full justify-center bg-green-600">
              <Loader2 className="h-3 w-3 mr-2 animate-spin" />
              {scanMode === 'qr' ? 'Scanning for QR/Barcode...' : 'Scanning for text...'}
            </Badge>
          )}

          {/* Manual Capture Button (fallback) */}
          {showManualCapture && isScanning && (
            <Button 
              onClick={() => {
                if (scanMode === 'ocr') {
                  processOCRFrame();
                }
                setScanAttempts(0);
              }}
              variant="outline"
              className="w-full"
            >
              <Camera className="h-4 w-4 mr-2" />
              Capture Now (Manual)
            </Button>
          )}

          {/* Controls */}
          <div className="flex gap-2">
            {isScanning ? (
              <>
                <Button 
                  onClick={stopScanning} 
                  variant="destructive" 
                  className="flex-1"
                >
                  <CameraOff className="h-4 w-4 mr-2" />
                  Stop
                </Button>
                {torchSupported && (
                  <Button
                    onClick={toggleTorch}
                    variant={torchEnabled ? 'default' : 'outline'}
                    size="icon"
                  >
                    <Flashlight className="h-4 w-4" />
                  </Button>
                )}
              </>
            ) : (
              <Button 
                onClick={handleClose} 
                variant="outline" 
                className="flex-1"
              >
                Cancel
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default OCRScanner;