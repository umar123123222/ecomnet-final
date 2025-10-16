import React, { useState, useEffect, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { useHandheldScanner } from '@/contexts/HandheldScannerContext';
import { BrowserMultiFormatReader } from '@zxing/browser';
import { useToast } from '@/hooks/use-toast';
import { Camera, Type, Keyboard, Loader2, CheckCircle2, XCircle } from 'lucide-react';
import Tesseract from 'tesseract.js';

export interface ScanResult {
  orderId?: string;
  trackingId?: string;
  rawData: string;
  method: 'handheld' | 'camera-barcode' | 'ocr' | 'manual';
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
  const [currentMethod, setCurrentMethod] = useState<'waiting' | 'handheld' | 'camera-barcode' | 'ocr' | 'manual'>('waiting');
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [manualEntry, setManualEntry] = useState({ trackingId: '', orderId: '' });
  const [scanStartTime, setScanStartTime] = useState<number>(0);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const codeReaderRef = useRef<BrowserMultiFormatReader | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  
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

    onScan(fullResult);
    toast({
      title: 'Scan Successful',
      description: `${result.method} scan completed in ${(scanDuration / 1000).toFixed(1)}s`,
    });
    onClose();
  };

  // Step 1: Try Handheld Scanner
  useEffect(() => {
    if (!isOpen || !handheldConnected) return;

    setCurrentMethod('handheld');
    setScanStartTime(Date.now());
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

    // Wait 500ms for handheld scan
    timeoutRef.current = setTimeout(() => {
      setCurrentMethod('camera-barcode');
      setProgress(30);
    }, 500);

    return cleanup;
  }, [isOpen, handheldConnected]);

  // Step 2: Try Camera Barcode
  useEffect(() => {
    if (!isOpen || currentMethod !== 'camera-barcode') return;

    const startBarcodeScanning = async () => {
      try {
        const codeReader = new BrowserMultiFormatReader();
        codeReaderRef.current = codeReader;

        const videoInputDevices = await BrowserMultiFormatReader.listVideoInputDevices();
        const backCamera = videoInputDevices.find(device => 
          device.label.toLowerCase().includes('back')
        ) || videoInputDevices[0];

        if (!videoRef.current) return;

        codeReader.decodeFromVideoDevice(
          backCamera?.deviceId,
          videoRef.current,
          (result, error) => {
            if (result) {
              const text = result.getText();
              const { trackingId, orderId } = extractIds(text);
              
              if (videoRef.current) {
                const stream = videoRef.current.srcObject as MediaStream;
                stream?.getTracks().forEach(track => track.stop());
              }
              
              emitResult({
                trackingId,
                orderId,
                rawData: text,
                method: 'camera-barcode',
                confidence: 95,
              });
            }
          }
        );

        setProgress(50);

        // 2-second timeout for barcode scanning
        timeoutRef.current = setTimeout(() => {
          if (videoRef.current) {
            const stream = videoRef.current.srcObject as MediaStream;
            stream?.getTracks().forEach(track => track.stop());
          }
          setCurrentMethod('manual');
          setProgress(70);
          toast({
            title: 'No Barcode Detected',
            description: 'Try OCR or enter manually',
          });
        }, 2000);
      } catch (error) {
        console.error('Barcode scanning error:', error);
        setCurrentMethod('manual');
      }
    };

    startBarcodeScanning();

    return () => {
      if (videoRef.current) {
        const stream = videoRef.current.srcObject as MediaStream;
        stream?.getTracks().forEach(track => track.stop());
      }
    };
  }, [isOpen, currentMethod]);

  // Step 3: OCR Fallback (user-initiated)
  const handleOCRScan = async () => {
    if (!videoRef.current || !canvasRef.current) return;

    setCurrentMethod('ocr');
    setProcessing(true);
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
          description: 'Please enter manually',
          variant: 'destructive',
        });
        setCurrentMethod('manual');
      }
    } catch (error) {
      console.error('OCR error:', error);
      toast({
        title: 'OCR Failed',
        description: 'Please enter manually',
        variant: 'destructive',
      });
      setCurrentMethod('manual');
    } finally {
      setProcessing(false);
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
      setCurrentMethod(handheldConnected ? 'handheld' : 'camera-barcode');
    }

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      if (videoRef.current) {
        const stream = videoRef.current.srcObject as MediaStream;
        stream?.getTracks().forEach(track => track.stop());
      }
    };
  }, [isOpen]);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {title}
            <Badge variant="outline">{currentMethod}</Badge>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Progress Bar */}
          <Progress value={progress} className="w-full" />

          {/* Method Indicators */}
          <div className="flex justify-around text-sm">
            <div className={`flex items-center gap-1 ${currentMethod === 'handheld' ? 'text-primary' : 'text-muted-foreground'}`}>
              <Keyboard className="h-4 w-4" />
              <span>Handheld</span>
              {handheldConnected && <CheckCircle2 className="h-3 w-3 text-green-600" />}
              {!handheldConnected && <XCircle className="h-3 w-3 text-red-600" />}
            </div>
            <div className={`flex items-center gap-1 ${currentMethod === 'camera-barcode' ? 'text-primary' : 'text-muted-foreground'}`}>
              <Camera className="h-4 w-4" />
              <span>Barcode</span>
            </div>
            <div className={`flex items-center gap-1 ${currentMethod === 'ocr' ? 'text-primary' : 'text-muted-foreground'}`}>
              <Type className="h-4 w-4" />
              <span>OCR</span>
            </div>
          </div>

          {/* Video Preview */}
          {(currentMethod === 'camera-barcode' || currentMethod === 'ocr') && (
            <div className="relative bg-black rounded-lg overflow-hidden aspect-video">
              <video ref={videoRef} className="w-full h-full object-cover" autoPlay playsInline muted />
              <canvas ref={canvasRef} className="hidden" />
              
              {/* ROI Overlay */}
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="border-2 border-green-500 w-3/4 h-2/3 rounded-lg" />
              </div>

              {processing && (
                <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                  <Loader2 className="h-8 w-8 animate-spin text-white" />
                </div>
              )}
            </div>
          )}

          {/* Manual Entry Form */}
          {currentMethod === 'manual' && (
            <div className="space-y-4 p-4 border rounded-lg">
              <div>
                <label className="text-sm font-medium">Tracking ID</label>
                <Input
                  placeholder="Enter tracking ID"
                  value={manualEntry.trackingId}
                  onChange={(e) => setManualEntry(prev => ({ ...prev, trackingId: e.target.value }))}
                />
              </div>
              <div>
                <label className="text-sm font-medium">Order ID</label>
                <Input
                  placeholder="Enter order ID"
                  value={manualEntry.orderId}
                  onChange={(e) => setManualEntry(prev => ({ ...prev, orderId: e.target.value }))}
                />
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex justify-between">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            
            <div className="flex gap-2">
              {currentMethod === 'camera-barcode' && (
                <Button variant="secondary" onClick={handleOCRScan} disabled={processing}>
                  Try OCR
                </Button>
              )}
              
              {currentMethod === 'manual' && (
                <Button onClick={handleManualSubmit}>
                  Submit
                </Button>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default UnifiedScanner;
