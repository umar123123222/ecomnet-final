import React, { useEffect, useRef, useState } from 'react';
import { BrowserMultiFormatReader, NotFoundException } from '@zxing/library';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Camera, X } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface ScannerProps {
  isOpen: boolean;
  onClose: () => void;
  onScan: (data: { orderId?: string; trackingId?: string; rawData: string }) => void;
  title?: string;
  scanType?: 'dispatch' | 'return';
}

export const Scanner: React.FC<ScannerProps> = ({ 
  isOpen, 
  onClose, 
  onScan, 
  title = "Scan QR Code",
  scanType = 'dispatch'
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [error, setError] = useState<string>('');
  const codeReader = useRef<BrowserMultiFormatReader | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (isOpen) {
      startScanning();
    } else {
      stopScanning();
    }

    return () => {
      stopScanning();
    };
  }, [isOpen]);

  const extractOrderData = (scannedText: string) => {
    // Try to extract order ID and tracking ID from various formats
    let orderId = '';
    let trackingId = '';

    // Common patterns for order IDs and tracking IDs
    const orderIdPatterns = [
      /order[_\s]*id[:\s]*([a-z0-9\-]+)/i,
      /order[_\s]*number[:\s]*([a-z0-9\-]+)/i,
      /order[:\s]*([a-z0-9\-]+)/i,
      /ord[:\s]*([a-z0-9\-]+)/i,
    ];

    const trackingIdPatterns = [
      /tracking[_\s]*id[:\s]*([a-z0-9\-]+)/i,
      /tracking[_\s]*number[:\s]*([a-z0-9\-]+)/i,
      /track[:\s]*([a-z0-9\-]+)/i,
      /shipment[:\s]*([a-z0-9\-]+)/i,
    ];

    // Try to extract order ID
    for (const pattern of orderIdPatterns) {
      const match = scannedText.match(pattern);
      if (match && match[1]) {
        orderId = match[1].trim();
        break;
      }
    }

    // Try to extract tracking ID
    for (const pattern of trackingIdPatterns) {
      const match = scannedText.match(pattern);
      if (match && match[1]) {
        trackingId = match[1].trim();
        break;
      }
    }

    // If no patterns match, try to extract UUIDs or alphanumeric codes
    if (!orderId && !trackingId) {
      const uuidPattern = /[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}/gi;
      const uuids = scannedText.match(uuidPattern);
      
      if (uuids && uuids.length >= 1) {
        orderId = uuids[0];
        if (uuids.length >= 2) {
          trackingId = uuids[1];
        }
      } else {
        // Try to extract any alphanumeric code
        const codePattern = /[A-Z0-9]{6,}/g;
        const codes = scannedText.match(codePattern);
        if (codes && codes.length >= 1) {
          orderId = codes[0];
          if (codes.length >= 2) {
            trackingId = codes[1];
          }
        }
      }
    }

    return { orderId, trackingId };
  };

  const startScanning = async () => {
    try {
      setError('');
      setIsScanning(true);

      if (!codeReader.current) {
        codeReader.current = new BrowserMultiFormatReader();
      }

      const videoInputDevices = await codeReader.current.listVideoInputDevices();
      
      if (videoInputDevices.length === 0) {
        throw new Error('No camera devices found');
      }

      // Prefer back camera if available
      const backCamera = videoInputDevices.find(device => 
        device.label.toLowerCase().includes('back') || 
        device.label.toLowerCase().includes('rear')
      );
      
      const selectedDeviceId = backCamera?.deviceId || videoInputDevices[0].deviceId;

      await codeReader.current.decodeFromVideoDevice(
        selectedDeviceId,
        videoRef.current!,
        async (result, error) => {
          if (result) {
            const scannedText = result.getText();
            const { orderId, trackingId } = extractOrderData(scannedText);
            
            // Store scan result in conversations table if we have order/customer data
            if (orderId || trackingId) {
              try {
                await supabase.from('conversations').insert({
                  order_id: orderId || 'unknown',
                  customer_id: 'unknown', // You might want to pass this as a prop
                  message_content: `${scanType} scan: ${scannedText}`,
                  message_type: 'incoming',
                  sender_name: 'Scanner Device'
                });
              } catch (error) {
                console.error('Failed to save scan record:', error);
              }
            }
            
            onScan({
              orderId,
              trackingId,
              rawData: scannedText
            });

            toast({
              title: "Scan Successful",
              description: `Scanned: ${orderId || trackingId || scannedText.substring(0, 50)}`,
            });

            stopScanning();
            onClose();
          } else if (error && !(error instanceof NotFoundException)) {
            console.error('Scanning error:', error);
          }
        }
      );
    } catch (err) {
      console.error('Failed to start scanning:', err);
      setError(err instanceof Error ? err.message : 'Failed to access camera');
      setIsScanning(false);
      
      toast({
        title: "Camera Error",
        description: "Failed to access camera. Please check permissions.",
        variant: "destructive",
      });
    }
  };

  const stopScanning = () => {
    if (codeReader.current) {
      codeReader.current.reset();
    }
    setIsScanning(false);
  };

  const handleClose = () => {
    stopScanning();
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Camera className="h-5 w-5" />
            {title}
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          {error ? (
            <div className="text-destructive text-sm text-center p-4">
              {error}
            </div>
          ) : (
            <div className="relative">
              <video
                ref={videoRef}
                className="w-full h-64 bg-muted rounded-lg object-cover"
                playsInline
                muted
              />
              {isScanning && (
                <div className="absolute inset-0 border-2 border-primary rounded-lg">
                  <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
                    <div className="w-32 h-32 border-2 border-primary border-dashed rounded-lg animate-pulse" />
                  </div>
                </div>
              )}
            </div>
          )}
          
          <div className="text-sm text-muted-foreground text-center">
            Position the QR code or barcode within the frame
          </div>
          
          <div className="flex gap-2">
            <Button 
              onClick={handleClose} 
              variant="outline" 
              className="flex-1"
            >
              <X className="h-4 w-4 mr-2" />
              Cancel
            </Button>
            {error && (
              <Button 
                onClick={startScanning} 
                className="flex-1"
              >
                <Camera className="h-4 w-4 mr-2" />
                Retry
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};