import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScanBarcode, Type, Wifi, WifiOff } from 'lucide-react';
import { useHandheldScanner } from '@/contexts/HandheldScannerContext';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface BarcodeScannerProps {
  isOpen: boolean;
  onClose: () => void;
  onScan: (result: ScanResult) => void;
  scanType?: 'product' | 'order' | 'tracking' | 'package' | 'transfer';
  title?: string;
  outletId?: string;
  context?: Record<string, any>;
}

export interface ScanResult {
  barcode: string;
  productId?: string;
  method: 'handheld' | 'camera' | 'ocr' | 'manual';
  confidence?: number;
  timestamp: Date;
  rawData?: string;
}

export const BarcodeScanner = ({
  isOpen,
  onClose,
  onScan,
  scanType = 'product',
  title = 'Scan Barcode',
  outletId,
  context = {},
}: BarcodeScannerProps) => {
  const [activeTab, setActiveTab] = useState<'scanner' | 'manual'>('scanner');
  const [manualBarcode, setManualBarcode] = useState('');
  const { isConnected, deviceName, connect, onScan: onHandheldScan } = useHandheldScanner();
  const { toast } = useToast();

  // Listen for handheld scanner input when scanner tab is active
  useEffect(() => {
    if (activeTab === 'scanner' && isConnected) {
      const cleanup = onHandheldScan((barcode) => {
        handleScanResult(barcode, 'handheld');
      });
      return cleanup;
    }
  }, [activeTab, isConnected]);

  const handleScanResult = async (barcodeValue: string, method: 'handheld' | 'manual') => {
    // Call process-scan edge function
    try {
      const { data: scanData, error } = await supabase.functions.invoke('process-scan', {
        body: {
          barcode: barcodeValue,
          scanType: scanType,
          method: method,
          outletId: outletId,
          context: context
        }
      });

      if (error) throw error;

      const scanResult: ScanResult = {
        barcode: barcodeValue,
        productId: scanData?.product?.id,
        method: method,
        confidence: 100,
        timestamp: new Date(),
        rawData: barcodeValue,
      };

      onScan(scanResult);
      
      if (scanData?.product) {
        toast({
          title: 'Product Found',
          description: `${scanData.product.name} (${scanData.product.sku})`,
        });
      } else {
        toast({
          title: 'Barcode Scanned',
          description: barcodeValue,
        });
      }
    } catch (error: any) {
      console.error('Scan processing error:', error);
      toast({
        title: 'Scan Error',
        description: error.message || 'Failed to process scan',
        variant: 'destructive',
      });
    }
  };

  const handleManualSubmit = async () => {
    if (!manualBarcode.trim()) {
      toast({
        title: 'Invalid Input',
        description: 'Please enter a barcode',
        variant: 'destructive',
      });
      return;
    }

    await handleScanResult(manualBarcode.trim(), 'manual');
    setManualBarcode('');
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="scanner">
              <ScanBarcode className="mr-2 h-4 w-4" />
              Handheld Scanner
            </TabsTrigger>
            <TabsTrigger value="manual">
              <Type className="mr-2 h-4 w-4" />
              Manual Entry
            </TabsTrigger>
          </TabsList>

          <TabsContent value="scanner" className="mt-4 space-y-4">
            <div className="flex flex-col items-center justify-center space-y-4 p-8 border rounded-lg">
              {isConnected ? (
                <>
                  <div className="flex items-center gap-2 text-green-600">
                    <Wifi className="h-8 w-8" />
                    <span className="text-lg font-medium">Scanner Connected</span>
                  </div>
                  <p className="text-sm text-muted-foreground text-center">
                    {deviceName || 'HID Keyboard Scanner'}
                  </p>
                  <p className="text-sm text-muted-foreground text-center">
                    Scan a barcode using your handheld scanner
                  </p>
                </>
              ) : (
                <>
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <WifiOff className="h-8 w-8" />
                    <span className="text-lg font-medium">Scanner Disconnected</span>
                  </div>
                  <p className="text-sm text-muted-foreground text-center">
                    Connect your handheld scanner to begin scanning
                  </p>
                  <Button onClick={connect}>
                    Connect Scanner
                  </Button>
                </>
              )}
            </div>
          </TabsContent>

          <TabsContent value="manual" className="mt-4 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="manual-barcode">Enter Barcode/SKU</Label>
              <Input
                id="manual-barcode"
                value={manualBarcode}
                onChange={(e) => setManualBarcode(e.target.value)}
                placeholder="Enter barcode or SKU"
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    handleManualSubmit();
                  }
                }}
                autoFocus
              />
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button onClick={handleManualSubmit}>
                Submit
              </Button>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};
