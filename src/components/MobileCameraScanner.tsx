import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { X, Camera, Flashlight, FlashlightOff, SwitchCamera, Volume2 } from 'lucide-react';
import { BrowserMultiFormatReader } from '@zxing/library';

interface MobileCameraScannerProps {
  isOpen: boolean;
  onClose: () => void;
  onScan: (data: string) => void;
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

  // Audio feedback
  const successSound = useRef<HTMLAudioElement | null>(null);
  
  useEffect(() => {
    successSound.current = new Audio('/sounds/success.mp3');
    successSound.current.volume = 0.5;
  }, []);

  const playSuccessSound = useCallback(() => {
    if (successSound.current) {
      successSound.current.currentTime = 0;
      successSound.current.play().catch(e => console.log('Audio play failed:', e));
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
        (result, error) => {
          if (result) {
            const scannedText = result.getText();
            
            // Prevent duplicate scans within 2 seconds
            if (scannedText !== lastScannedCode) {
              setLastScannedCode(scannedText);
              playSuccessSound();
              onScan(scannedText);
              
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
  }, [facingMode, lastScannedCode, onScan, playSuccessSound]);

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

  // Start camera when dialog opens
  useEffect(() => {
    if (isOpen) {
      startCamera();
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
    onClose();
  }, [stopCamera, onClose]);

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
                  {isScanning && (
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

              {/* Instructions */}
              <div className="absolute bottom-24 left-0 right-0 text-center">
                <p className="text-white text-sm bg-black/50 inline-block px-4 py-2 rounded-full">
                  {lastScannedCode ? '✓ Scanned! Ready for next...' : 'Point camera at barcode'}
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
