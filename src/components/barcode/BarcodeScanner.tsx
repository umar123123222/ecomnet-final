import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScanBarcode, Keyboard, Type } from 'lucide-react';
import { useHandheldScanner } from '@/contexts/HandheldScannerContext';
import { useToast } from '@/hooks/use-toast';
import UnifiedScanner from '@/components/UnifiedScanner';
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
  const { toast } = useToast();

  const handleScanResult = async (result: any) => {
    const barcodeValue = result.rawData || result.trackingId || result.orderId || '';
    
    // Call process-scan edge function
    try {
      const { data: scanData, error } = await supabase.functions.invoke('process-scan', {
        body: {
          barcode: barcodeValue,
          scanType: scanType,
          method: result.method || 'camera',
          outletId: outletId,
          context: context
        }
      });

      if (error) throw error;

      const scanResult: ScanResult = {
        barcode: barcodeValue,
        productId: scanData?.product?.id || result.productId,
        method: result.method || 'camera',
        confidence: result.confidence,
        timestamp: new Date(),
        rawData: result.rawData,
      };

      onScan(scanResult);
      
      if (scanData?.product) {
        toast({
          title: 'Product Found',
          description: `${scanData.product.name} (${scanData.product.sku})`,
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

  const handleManualSubmit = () => {
    if (!manualBarcode.trim()) {
      toast({
        title: 'Invalid Input',
        description: 'Please enter a barcode',
        variant: 'destructive',
      });
      return;
    }

    const scanResult: ScanResult = {
      barcode: manualBarcode.trim(),
      method: 'manual',
      timestamp: new Date(),
      confidence: 100,
    };

    onScan(scanResult);
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
              Scan
            </TabsTrigger>
            <TabsTrigger value="manual">
              <Type className="mr-2 h-4 w-4" />
              Manual Entry
            </TabsTrigger>
          </TabsList>

          <TabsContent value="scanner" className="mt-4">
            <UnifiedScanner
              isOpen={activeTab === 'scanner'}
              onClose={onClose}
              onScan={handleScanResult}
              scanType="receiving"
              title=""
            />
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
