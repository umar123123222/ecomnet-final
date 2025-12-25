import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { X, Camera, Flashlight, FlashlightOff, SwitchCamera, Volume2, CheckCircle, XCircle, Clock } from 'lucide-react';
import { BrowserMultiFormatReader } from '@zxing/library';
import { jsPDF } from 'jspdf';

export interface ScanResult {
  success: boolean;
  entry: string;
  orderNumber?: string;
  error?: string;
  processingTime: number;
  timestamp: Date;
}

interface MobileCameraScannerProps {
  isOpen: boolean;
  onClose: () => void;
  onScan: (data: string) => Promise<ScanResult>;
  title?: string;
}

const MobileCameraScanner: React.FC<MobileCameraScannerProps> = ({
  isOpen,
  onClose,
  onScan,
  title = 'Scan Barcode'
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const readerRef = useRef<BrowserMultiFormatReader | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [torchEnabled, setTorchEnabled] = useState(false);
  const [torchSupported, setTorchSupported] = useState(false);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [lastScannedCode, setLastScannedCode] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // Scan statistics
  const [scanResults, setScanResults] = useState<ScanResult[]>([]);
  const successCount = scanResults.filter(r => r.success).length;
  const failedCount = scanResults.filter(r => !r.success).length;
  const avgProcessingTime = scanResults.length > 0 
    ? Math.round(scanResults.reduce((sum, r) => sum + r.processingTime, 0) / scanResults.length)
    : 0;

  // Audio feedback
  const successSound = useRef<HTMLAudioElement | null>(null);
  const errorSound = useRef<HTMLAudioElement | null>(null);
  
  useEffect(() => {
    successSound.current = new Audio('/sounds/success.mp3');
    successSound.current.volume = 0.5;
    errorSound.current = new Audio('/sounds/error.mp3');
    errorSound.current.volume = 0.5;
  }, []);

  const playSuccessSound = useCallback(() => {
    if (successSound.current) {
      successSound.current.currentTime = 0;
      successSound.current.play().catch(e => console.log('Audio play failed:', e));
    }
  }, []);

  const playErrorSound = useCallback(() => {
    if (errorSound.current) {
      errorSound.current.currentTime = 0;
      errorSound.current.play().catch(e => console.log('Audio play failed:', e));
    }
  }, []);

  const stopCamera = useCallback(() => {
    if (readerRef.current) {
      readerRef.current.reset();
      readerRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setIsScanning(false);
  }, []);

  const startCamera = useCallback(async () => {
    try {
      setError(null);
      setIsScanning(true);

      // Request camera permission
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: facingMode,
          width: { ideal: 1280 },
          height: { ideal: 720 }
        }
      });

      streamRef.current = stream;
      setHasPermission(true);

      // Check torch support
      const track = stream.getVideoTracks()[0];
      const capabilities = track.getCapabilities?.() as MediaTrackCapabilities & { torch?: boolean };
      setTorchSupported(!!capabilities?.torch);

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      // Initialize barcode reader
      const reader = new BrowserMultiFormatReader();
      readerRef.current = reader;

      // Start continuous scanning
      reader.decodeFromVideoDevice(
        undefined,
        videoRef.current!,
        async (result, error) => {
          if (result && !isProcessing) {
            const scannedText = result.getText();
            
            // Prevent duplicate scans within 2 seconds
            if (scannedText !== lastScannedCode) {
              setLastScannedCode(scannedText);
              setIsProcessing(true);
              
              const startTime = Date.now();
              
              try {
                const scanResult = await onScan(scannedText);
                
                setScanResults(prev => [...prev, scanResult]);
                
                if (scanResult.success) {
                  playSuccessSound();
                } else {
                  playErrorSound();
                }
              } catch (err: any) {
                playErrorSound();
                setScanResults(prev => [...prev, {
                  success: false,
                  entry: scannedText,
                  error: err.message || 'Unknown error',
                  processingTime: Date.now() - startTime,
                  timestamp: new Date()
                }]);
              }
              
              setIsProcessing(false);
              
              // Reset last scanned code after 2 seconds
              setTimeout(() => setLastScannedCode(null), 2000);
            }
          }
        }
      );
    } catch (err: any) {
      console.error('Camera error:', err);
      setHasPermission(false);
      setIsScanning(false);
      
      if (err.name === 'NotAllowedError') {
        setError('Camera permission denied. Please allow camera access in your browser settings.');
      } else if (err.name === 'NotFoundError') {
        setError('No camera found on this device.');
      } else {
        setError(`Camera error: ${err.message}`);
      }
    }
  }, [facingMode, lastScannedCode, onScan, playSuccessSound, playErrorSound, isProcessing]);

  const toggleTorch = useCallback(async () => {
    if (!streamRef.current || !torchSupported) return;

    const track = streamRef.current.getVideoTracks()[0];
    try {
      await track.applyConstraints({
        advanced: [{ torch: !torchEnabled } as MediaTrackConstraintSet & { torch: boolean }]
      });
      setTorchEnabled(!torchEnabled);
    } catch (err) {
      console.error('Torch toggle failed:', err);
    }
  }, [torchEnabled, torchSupported]);

  const switchCamera = useCallback(() => {
    stopCamera();
    setFacingMode(prev => prev === 'environment' ? 'user' : 'environment');
  }, [stopCamera]);

  // Generate and download failed scans PDF
  const downloadFailedScansPDF = useCallback(() => {
    const failedScans = scanResults.filter(r => !r.success);
    if (failedScans.length === 0) return;

    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    
    // Title
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text('Failed Scans Report', pageWidth / 2, 20, { align: 'center' });
    
    // Summary
    doc.setFontSize(12);
    doc.setFont('helvetica', 'normal');
    doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 35);
    doc.text(`Total Scans: ${scanResults.length}`, 14, 42);
    doc.text(`Successful: ${successCount}`, 14, 49);
    doc.text(`Failed: ${failedCount}`, 14, 56);
    doc.text(`Avg Processing Time: ${avgProcessingTime}ms`, 14, 63);
    
    // Divider
    doc.setDrawColor(200, 200, 200);
    doc.line(14, 70, pageWidth - 14, 70);
    
    // Failed scans details
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('Failed Scan Details', 14, 80);
    
    let yPos = 90;
    const lineHeight = 7;
    
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    
    failedScans.forEach((scan, index) => {
      // Check if we need a new page
      if (yPos > 270) {
        doc.addPage();
        yPos = 20;
      }
      
      doc.setFont('helvetica', 'bold');
      doc.text(`${index + 1}. ${scan.entry}`, 14, yPos);
      yPos += lineHeight;
      
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(150, 50, 50);
      doc.text(`   Error: ${scan.error || 'Unknown error'}`, 14, yPos);
      doc.setTextColor(0, 0, 0);
      yPos += lineHeight;
      
      doc.setTextColor(100, 100, 100);
      doc.text(`   Time: ${scan.timestamp.toLocaleTimeString()} | Processing: ${scan.processingTime}ms`, 14, yPos);
      doc.setTextColor(0, 0, 0);
      yPos += lineHeight + 3;
    });
    
    // Save PDF
    const fileName = `failed-scans-${new Date().toISOString().split('T')[0]}-${Date.now()}.pdf`;
    doc.save(fileName);
  }, [scanResults, successCount, failedCount, avgProcessingTime]);

  // Start camera when dialog opens
  useEffect(() => {
    if (isOpen) {
      startCamera();
      setScanResults([]); // Reset stats when opening
    } else {
      stopCamera();
      setLastScannedCode(null);
    }

    return () => {
      stopCamera();
    };
  }, [isOpen, facingMode]);

  const handleClose = useCallback(() => {
    stopCamera();
    
    // Auto-download failed scans PDF if there are any
    const failedScans = scanResults.filter(r => !r.success);
    if (failedScans.length > 0) {
      downloadFailedScansPDF();
    }
    
    onClose();
  }, [stopCamera, onClose, scanResults, downloadFailedScansPDF]);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="max-w-full h-[100dvh] sm:max-w-lg sm:h-auto p-0 gap-0 bg-black border-none">
        {/* Header */}
        <div className="flex items-center justify-between p-4 bg-black/80 backdrop-blur-sm absolute top-0 left-0 right-0 z-10">
          <h2 className="text-white font-semibold text-lg">{title}</h2>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleClose}
            className="text-white hover:bg-white/20"
          >
            <X className="h-6 w-6" />
          </Button>
        </div>

        {/* Camera View */}
        <div className="relative w-full h-full min-h-[400px] flex items-center justify-center bg-black">
          {error ? (
            <div className="text-center p-6">
              <Camera className="h-16 w-16 text-red-500 mx-auto mb-4" />
              <p className="text-white text-lg mb-4">{error}</p>
              <Button onClick={startCamera} variant="secondary">
                Try Again
              </Button>
            </div>
          ) : hasPermission === false ? (
            <div className="text-center p-6">
              <Camera className="h-16 w-16 text-amber-500 mx-auto mb-4" />
              <p className="text-white text-lg mb-2">Camera Permission Required</p>
              <p className="text-gray-400 text-sm mb-4">
                Please allow camera access to scan barcodes
              </p>
              <Button onClick={startCamera} variant="secondary">
                Request Permission
              </Button>
            </div>
          ) : (
            <>
              <video
                ref={videoRef}
                className="w-full h-full object-cover"
                playsInline
                muted
                autoPlay
              />
              
              {/* Scanning Frame Overlay */}
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="relative w-72 h-48 sm:w-80 sm:h-52">
                  {/* Corner brackets */}
                  <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-primary rounded-tl-lg" />
                  <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-primary rounded-tr-lg" />
                  <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-primary rounded-bl-lg" />
                  <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-primary rounded-br-lg" />
                  
                  {/* Scanning line animation */}
                  {isScanning && !isProcessing && (
                    <div 
                      className="absolute left-2 right-2 h-0.5 bg-primary"
                      style={{
                        animation: 'scanLine 2s ease-in-out infinite',
                        top: '50%'
                      }}
                    />
                  )}
                </div>
              </div>

              {/* Stats Overlay - Top Corners */}
              <div className="absolute top-20 left-4 right-4 flex justify-between pointer-events-none z-20">
                {/* Success Count - Top Left */}
                <div className="flex items-center gap-2 bg-green-600 shadow-lg px-4 py-2 rounded-full">
                  <CheckCircle className="h-5 w-5 text-white" />
                  <span className="text-white font-bold text-base">{successCount}</span>
                </div>
                
                {/* Failed Count - Top Right */}
                <div className="flex items-center gap-2 bg-red-600 shadow-lg px-4 py-2 rounded-full">
                  <XCircle className="h-5 w-5 text-white" />
                  <span className="text-white font-bold text-base">{failedCount}</span>
                </div>
              </div>

              {/* Avg Processing Time - Below scanning frame */}
              {scanResults.length > 0 && (
                <div className="absolute top-[calc(50%+80px)] left-1/2 -translate-x-1/2 pointer-events-none">
                  <div className="flex items-center gap-1.5 bg-black/70 backdrop-blur-sm px-3 py-1.5 rounded-full">
                    <Clock className="h-3.5 w-3.5 text-blue-400" />
                    <span className="text-white text-xs">Avg: {avgProcessingTime}ms</span>
                  </div>
                </div>
              )}

              {/* Instructions / Status */}
              <div className="absolute bottom-24 left-0 right-0 text-center">
                <p className="text-white text-sm bg-black/50 inline-block px-4 py-2 rounded-full">
                  {isProcessing 
                    ? '⏳ Processing...' 
                    : lastScannedCode 
                      ? '✓ Scanned! Ready for next...' 
                      : 'Point camera at barcode'}
                </p>
              </div>
            </>
          )}
        </div>

        {/* Controls */}
        <div className="flex items-center justify-center gap-6 p-4 bg-black/80 backdrop-blur-sm absolute bottom-0 left-0 right-0">
          {torchSupported && (
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleTorch}
              className="text-white hover:bg-white/20 h-12 w-12"
            >
              {torchEnabled ? (
                <FlashlightOff className="h-6 w-6" />
              ) : (
                <Flashlight className="h-6 w-6" />
              )}
            </Button>
          )}
          
          <Button
            variant="ghost"
            size="icon"
            onClick={switchCamera}
            className="text-white hover:bg-white/20 h-12 w-12"
          >
            <SwitchCamera className="h-6 w-6" />
          </Button>

          <Button
            variant="ghost"
            size="icon"
            onClick={playSuccessSound}
            className="text-white hover:bg-white/20 h-12 w-12"
            title="Test sound"
          >
            <Volume2 className="h-6 w-6" />
          </Button>
        </div>

        {/* CSS for scan line animation */}
        <style>{`
          @keyframes scanLine {
            0%, 100% { transform: translateY(-40px); opacity: 0.5; }
            50% { transform: translateY(40px); opacity: 1; }
          }
        `}</style>
      </DialogContent>
    </Dialog>
  );
};

export default MobileCameraScanner;
