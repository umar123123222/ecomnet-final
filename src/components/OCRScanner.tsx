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
  initialScanMode?: 'qr' | 'ocr';
}

type ScanMode = 'qr' | 'ocr';

const OCRScanner: React.FC<OCRScannerProps> = ({
  isOpen,
  onClose,
  onScan,
  title = "Scan Order",
  scanType,
  initialScanMode = 'qr'
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const codeReader = useRef<BrowserMultiFormatReader | null>(null);
  const ocrWorker = useRef<any>(null);
  const scanIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const ocrBusyRef = useRef(false);
  
  const [isScanning, setIsScanning] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [stopAfterFirst, setStopAfterFirst] = useState(false);
  const [scanMode, setScanMode] = useState<ScanMode>(initialScanMode);
  const [error, setError] = useState<string | null>(null);
  const [detectedOrderId, setDetectedOrderId] = useState('');
  const [torchSupported, setTorchSupported] = useState(false);
  const [torchEnabled, setTorchEnabled] = useState(false);
  const [ocrProgress, setOcrProgress] = useState(0);
  const [scanAttempts, setScanAttempts] = useState(0);
  const [showManualCapture, setShowManualCapture] = useState(false);
  
  // OCR text preview and settings
  const [lastOcrText, setLastOcrText] = useState('');
  const [lastOcrConfidence, setLastOcrConfidence] = useState(0);
  const [roiMode, setRoiMode] = useState<'narrow' | 'wide' | 'full'>('wide');
  const [aggressiveBinarize, setAggressiveBinarize] = useState(false);
  const [showTextPreview, setShowTextPreview] = useState(true);
  const [psmMode, setPsmMode] = useState<'auto' | 'single' | 'sparse'>('auto');
  const [showRoiSnapshot, setShowRoiSnapshot] = useState(false);
  const [roiSnapshotUrl, setRoiSnapshotUrl] = useState('');

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

  // Helper to rotate image for orientation trials
  const rotateDataUrl = (src: string, angle: number): Promise<string> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const c = document.createElement('canvas');
        const ctx = c.getContext('2d')!;
        if (angle % 180 === 0) {
          c.width = img.width;
          c.height = img.height;
        } else {
          c.width = img.height;
          c.height = img.width;
        }
        ctx.translate(c.width / 2, c.height / 2);
        ctx.rotate((angle * Math.PI) / 180);
        ctx.drawImage(img, -img.width / 2, -img.height / 2);
        resolve(c.toDataURL('image/png'));
      };
      img.src = src;
    });
  };

  // Helper to recognize text at multiple orientations
  const recognizeBestOrientation = async (dataUrl: string): Promise<{ text: string; conf: number }> => {
    const rotations = [0, 90, 180, 270];
    let best = { text: '', conf: 0 };
    
    for (const angle of rotations) {
      const rotatedUrl = await rotateDataUrl(dataUrl, angle);
      const r = await ocrWorker.current.recognize(rotatedUrl);
      const conf = r.data.confidence || 0;
      if (conf > best.conf) {
        best = { text: r.data.text || '', conf };
      }
      if (best.conf >= 85) break; // early exit if very confident
    }
    
    return best;
  };

  // Initialize OCR worker with proper lifecycle
  const initOCRWorker = async () => {
    try {
      if (!ocrWorker.current) {
        const worker = await createWorker('eng', 1, {
          logger: (m: any) => {
            if (m.status === 'recognizing text') {
              setOcrProgress(Math.round((m.progress || 0) * 100));
            }
          }
        });
        
        // Set PSM based on mode - default to PSM 6 (block of text)
        const psm = psmMode === 'single' ? '7' : psmMode === 'sparse' ? '11' : '6';
        await worker.setParameters({
          tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789#:-_',
          tessedit_pageseg_mode: psm as any,
          preserve_interword_spaces: '1',
          user_defined_dpi: '300'
        });
        
        ocrWorker.current = worker;
      } else {
        // Update PSM if mode changed
        const psm = psmMode === 'single' ? '7' : psmMode === 'sparse' ? '11' : '6';
        await ocrWorker.current.setParameters({
          tessedit_pageseg_mode: psm as any
        });
      }
    } catch (error) {
      console.error('OCR Worker initialization error:', error);
      setError('Failed to initialize OCR engine');
    }
  };

  const processOCRFrame = async () => {
    if (!videoRef.current || !canvasRef.current || !ocrWorker.current) return;
    if (ocrBusyRef.current) return; // Prevent overlapping OCR calls
    
    ocrBusyRef.current = true;
    
    try {
      const video = videoRef.current;
      
      // Guard: ensure video has valid dimensions
      if (video.videoWidth < 2 || video.videoHeight < 2) return;

      // Define ROI based on user-selected mode
      let roiW: number, roiH: number;
      switch (roiMode) {
        case 'wide':
          roiW = Math.floor(video.videoWidth * 0.9);
          roiH = Math.floor(video.videoHeight * 0.5);
          break;
        case 'full':
          roiW = video.videoWidth;
          roiH = video.videoHeight;
          break;
        case 'narrow':
        default:
          roiW = Math.floor(video.videoWidth * 0.8);
          roiH = Math.floor(video.videoHeight * 0.28);
          break;
      }
      const roiX = Math.floor((video.videoWidth - roiW) / 2);
      const roiY = Math.floor((video.videoHeight - roiH) / 2);

      // Create an offscreen canvas with higher quality
      const scale = Math.max(2, window.devicePixelRatio * 2);
      const roiCanvas = document.createElement('canvas');
      roiCanvas.width = Math.floor(roiW * scale);
      roiCanvas.height = Math.floor(roiH * scale);
      const rctx = roiCanvas.getContext('2d');
      if (!rctx) return;

      // Disable smoothing for sharper text
      rctx.imageSmoothingEnabled = false;

      // Draw ROI from video to canvas with scaling
      rctx.drawImage(video, roiX, roiY, roiW, roiH, 0, 0, roiCanvas.width, roiCanvas.height);

      // Preprocessing based on user settings
      const imgData = rctx.getImageData(0, 0, roiCanvas.width, roiCanvas.height);
      const d = imgData.data;
      
      // Always convert to grayscale first
      for (let i = 0; i < d.length; i += 4) {
        const gray = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
        d[i] = d[i + 1] = d[i + 2] = gray;
      }
      
      if (aggressiveBinarize) {
        // Adaptive threshold + light sharpen
        let sum = 0;
        for (let i = 0; i < d.length; i += 4) {
          sum += d[i];
        }
        const mean = sum / (d.length / 4);
        
        // Clamp contrast to avoid over-thresholding
        const threshold = Math.max(80, Math.min(180, mean * 0.95));
        
        for (let i = 0; i < d.length; i += 4) {
          const v = d[i] > threshold ? 255 : 0;
          d[i] = d[i + 1] = d[i + 2] = v;
        }
        
        // Light sharpen pass (3x3 kernel)
        const tempData = new Uint8ClampedArray(d);
        const w = roiCanvas.width;
        const h = roiCanvas.height;
        for (let y = 1; y < h - 1; y++) {
          for (let x = 1; x < w - 1; x++) {
            const i = (y * w + x) * 4;
            const kernel = [
              -0.1, -0.1, -0.1,
              -0.1,  1.8, -0.1,
              -0.1, -0.1, -0.1
            ];
            let sum = 0;
            for (let ky = -1; ky <= 1; ky++) {
              for (let kx = -1; kx <= 1; kx++) {
                const ki = ((y + ky) * w + (x + kx)) * 4;
                sum += tempData[ki] * kernel[(ky + 1) * 3 + (kx + 1)];
              }
            }
            d[i] = d[i + 1] = d[i + 2] = Math.max(0, Math.min(255, sum));
          }
        }
      }
      
      rctx.putImageData(imgData, 0, 0);

      const imageData = roiCanvas.toDataURL('image/png');
      
      // Store ROI snapshot for debugging
      if (showRoiSnapshot) {
        setRoiSnapshotUrl(imageData);
      }

      // OCR with orientation handling
      const { text: recognizedText, conf: recognizedConf } = await recognizeBestOrientation(imageData);
      let text = recognizedText;
      let confidence = recognizedConf;
      
      // If auto mode and confidence is low, try different PSM modes
      if (psmMode === 'auto' && confidence < 60) {
        // Try PSM 11 (sparse text)
        await ocrWorker.current.setParameters({ tessedit_pageseg_mode: '11' as any });
        const psm11Result = await recognizeBestOrientation(imageData);
        if (psm11Result.conf > confidence) {
          text = psm11Result.text;
          confidence = psm11Result.conf;
        }
        
        // Try PSM 7 (single line) if still low
        if (confidence < 60) {
          await ocrWorker.current.setParameters({ tessedit_pageseg_mode: '7' as any });
          const psm7Result = await recognizeBestOrientation(imageData);
          if (psm7Result.conf > confidence) {
            text = psm7Result.text;
            confidence = psm7Result.conf;
          }
        }
        
        // Reset to PSM 6
        await ocrWorker.current.setParameters({ tessedit_pageseg_mode: '6' as any });
      }
      
      // If still very low confidence, try without whitelist
      if (confidence < 40) {
        await ocrWorker.current.setParameters({ tessedit_char_whitelist: '' });
        const noWhitelistResult = await recognizeBestOrientation(imageData);
        if (noWhitelistResult.conf > confidence) {
          text = noWhitelistResult.text;
          confidence = noWhitelistResult.conf;
        }
        // Reset whitelist
        await ocrWorker.current.setParameters({
          tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789#:-_'
        });
      }

      // Always update the preview with what was recognized
      setLastOcrText(text || '');
      setLastOcrConfidence(Math.round(confidence || 0));

      // Stop after first recognition if enabled
      if (stopAfterFirst && text && text.length > 0) {
        setIsPaused(true);
        if (scanIntervalRef.current) {
          clearInterval(scanIntervalRef.current);
          scanIntervalRef.current = null;
        }
      }

      // Only process for Order ID if confidence is above threshold
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
    } finally {
      ocrBusyRef.current = false;
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
        scanIntervalRef.current = setInterval(processOCRFrame, 1600);
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
    setLastOcrText('');
    setLastOcrConfidence(0);

    if (scanMode === 'qr') {
      await startQRScanning();
    } else {
      await startOCRScanning();
    }
  };

  // Pause scanning
  const pauseScanning = () => {
    setIsPaused(true);
    if (scanIntervalRef.current) {
      clearInterval(scanIntervalRef.current);
      scanIntervalRef.current = null;
    }
  };

  // Resume scanning
  const resumeScanning = () => {
    setIsPaused(false);
    if (scanMode === 'ocr' && !scanIntervalRef.current) {
      scanIntervalRef.current = setInterval(processOCRFrame, 1600);
    }
  };

  // Scan once (manual trigger)
  const scanOnce = async () => {
    if (scanMode === 'ocr') {
      await processOCRFrame();
    }
  };

  // Stop scanning
  const stopScanning = () => {
    setIsScanning(false);
    setIsPaused(false);
    
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

          {/* OCR Settings - only show in OCR mode */}
          {scanMode === 'ocr' && (
            <div className="space-y-3 p-3 bg-muted/50 rounded-lg border">
              {/* Scan Area Selector */}
              <div className="space-y-2">
                <Label className="text-xs font-medium">Scan Area</Label>
                <div className="flex gap-2">
                  <Button
                    variant={roiMode === 'narrow' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setRoiMode('narrow')}
                    className="flex-1"
                  >
                    Narrow
                  </Button>
                  <Button
                    variant={roiMode === 'wide' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setRoiMode('wide')}
                    className="flex-1"
                  >
                    Wide
                  </Button>
                  <Button
                    variant={roiMode === 'full' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setRoiMode('full')}
                    className="flex-1"
                  >
                    Full
                  </Button>
                </div>
              </div>

              {/* PSM Mode Selector */}
              <div className="space-y-2">
                <Label className="text-xs font-medium">Text Mode</Label>
                <div className="flex gap-2">
                  <Button
                    variant={psmMode === 'auto' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setPsmMode('auto')}
                    className="flex-1 text-xs"
                  >
                    Auto
                  </Button>
                  <Button
                    variant={psmMode === 'single' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setPsmMode('single')}
                    className="flex-1 text-xs"
                  >
                    Single Line
                  </Button>
                  <Button
                    variant={psmMode === 'sparse' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setPsmMode('sparse')}
                    className="flex-1 text-xs"
                  >
                    Sparse
                  </Button>
                </div>
              </div>

              {/* Processing Options */}
              <div className="flex items-center justify-between">
                <Label htmlFor="aggressive-contrast" className="text-xs font-medium cursor-pointer">
                  Aggressive Contrast
                </Label>
                <input
                  id="aggressive-contrast"
                  type="checkbox"
                  checked={aggressiveBinarize}
                  onChange={(e) => setAggressiveBinarize(e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary cursor-pointer"
                />
              </div>

              <div className="flex items-center justify-between">
                <Label htmlFor="show-preview" className="text-xs font-medium cursor-pointer">
                  Show Text Preview
                </Label>
                <input
                  id="show-preview"
                  type="checkbox"
                  checked={showTextPreview}
                  onChange={(e) => setShowTextPreview(e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary cursor-pointer"
                />
              </div>
              
               <div className="flex items-center justify-between">
                <Label htmlFor="show-roi" className="text-xs font-medium cursor-pointer">
                  Show ROI Snapshot
                </Label>
                <input
                  id="show-roi"
                  type="checkbox"
                  checked={showRoiSnapshot}
                  onChange={(e) => setShowRoiSnapshot(e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary cursor-pointer"
                />
              </div>

              <div className="flex items-center justify-between">
                <Label htmlFor="stop-first" className="text-xs font-medium cursor-pointer">
                  Stop after first recognition
                </Label>
                <input
                  id="stop-first"
                  type="checkbox"
                  checked={stopAfterFirst}
                  onChange={(e) => setStopAfterFirst(e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary cursor-pointer"
                />
              </div>
            </div>
          )}

          {/* Camera Preview */}
          <div className="relative bg-black rounded-lg overflow-hidden aspect-video">
            <video
              ref={videoRef}
              className="w-full h-full object-contain"
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
                    // Dynamic rectangular frame matching actual ROI
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div 
                        className="border-2 border-white rounded relative"
                        style={{
                          width: roiMode === 'full' ? '100%' : roiMode === 'wide' ? '90%' : '80%',
                          height: roiMode === 'full' ? '100%' : roiMode === 'wide' ? '50%' : '28%'
                        }}
                      >
                        <div className="absolute -top-6 left-2 text-white text-xs bg-black/70 px-2 py-1 rounded whitespace-nowrap">
                          Position text clearly in this box
                        </div>
                      </div>
                     </div>
                   )}
                 </div>
               )}

              {/* Always-visible OCR text overlay */}
              {scanMode === 'ocr' && isScanning && lastOcrText && (
                <div className="absolute bottom-2 left-2 right-2 bg-black/80 text-white text-xs px-3 py-2 rounded">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-medium">Last read:</span>
                    <Badge variant={lastOcrConfidence >= 60 ? 'default' : 'secondary'} className="text-xs">
                      {lastOcrConfidence}%
                    </Badge>
                  </div>
                  <div className="truncate">{lastOcrText}</div>
                </div>
              )}

              {/* OCR Progress and Status */}
              {scanMode === 'ocr' && ocrProgress > 0 && !lastOcrText && (
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

          {/* OCR Text Preview */}
          {scanMode === 'ocr' && showTextPreview && (
            <div className="space-y-2 p-3 bg-muted/50 rounded-lg border">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-medium">
                  Recognized Text
                </Label>
                <Badge variant={lastOcrConfidence >= 60 ? 'default' : 'secondary'} className="text-xs">
                  {lastOcrConfidence}% confidence
                </Badge>
              </div>
              <div className="max-h-32 overflow-y-auto bg-background p-2 rounded border text-xs font-mono break-words">
                {lastOcrText || '(no text detected yet)'}
              </div>
              
              {/* Low confidence tip */}
              {scanAttempts >= 5 && lastOcrConfidence < 40 && lastOcrText && (
                <div className="text-xs text-yellow-600 dark:text-yellow-400">
                  💡 Try: Move text to center, choose Full area, or turn off Aggressive Contrast
                </div>
              )}
              
              {/* ROI Snapshot for debugging */}
              {showRoiSnapshot && roiSnapshotUrl && (
                <div className="space-y-1">
                  <Label className="text-xs font-medium">ROI Snapshot (what OCR sees)</Label>
                  <img src={roiSnapshotUrl} alt="ROI" className="w-full border rounded" />
                </div>
              )}
            </div>
          )}

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
          <div className="space-y-2">
            {/* Scan Control Buttons */}
            {scanMode === 'ocr' && isScanning && (
              <div className="flex gap-2">
                <Button 
                  onClick={isPaused ? resumeScanning : pauseScanning}
                  variant="outline"
                  className="flex-1"
                >
                  {isPaused ? 'Resume' : 'Pause'}
                </Button>
                <Button 
                  onClick={scanOnce}
                  variant="outline"
                  className="flex-1"
                >
                  Scan Once
                </Button>
              </div>
            )}
            
            {/* Main Controls */}
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
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default OCRScanner;