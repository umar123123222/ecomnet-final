import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { generateBarcodeLabels } from '@/integrations/supabase/functions';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Printer, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { LabelData } from '@/types/production';
import { generateLabelHTML, printLabels } from '@/utils/labelTemplate';

export function LabelPrinter() {
  const [labelType, setLabelType] = useState<'raw_material' | 'finished_product' | 'packaging'>('finished_product');
  const [selectedItem, setSelectedItem] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [labelOptions, setLabelOptions] = useState({
    includePrice: false,
    includeBarcode: true,
    includeBatchInfo: false,
    includeExpiryDate: false,
  });

  const { data: products } = useQuery({
    queryKey: ['products-for-labels', labelType],
    queryFn: async () => {
      if (labelType === 'packaging') return [];
      
      const productType = labelType === 'raw_material' ? ['raw_material', 'both'] : ['finished', 'both'];
      const { data, error } = await supabase
        .from('products')
        .select('id, name, sku, barcode, barcode_format, price')
        .in('product_type', productType)
        .eq('is_active', true)
        .order('name');
      
      if (error) throw error;
      return data;
    },
    enabled: labelType !== 'packaging',
  });

  const { data: packagingItems } = useQuery({
    queryKey: ['packaging-for-labels'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('packaging_items')
        .select('id, name, sku, barcode, barcode_format, cost')
        .eq('is_active', true)
        .order('name');
      
      if (error) throw error;
      return data;
    },
    enabled: labelType === 'packaging',
  });

  const selectedItemData = labelType === 'packaging'
    ? packagingItems?.find(item => item.id === selectedItem)
    : products?.find(p => p.id === selectedItem);

  const printMutation = useMutation({
    mutationFn: async () => {
      if (!selectedItemData) throw new Error('No item selected');
      
      const labelData: LabelData = {
        productName: selectedItemData.name,
        sku: selectedItemData.sku,
        barcode: selectedItemData.barcode || '',
        barcodeFormat: (selectedItemData as any).barcode_format || 'CODE128',
        price: labelType === 'packaging' ? (selectedItemData as any).cost : (selectedItemData as any).price,
        ...labelOptions,
      };

      // Call edge function to log the print
      await generateBarcodeLabels({
        label_type: labelType,
        product_id: labelType !== 'packaging' ? selectedItem : undefined,
        packaging_item_id: labelType === 'packaging' ? selectedItem : undefined,
        quantity: parseInt(quantity),
        label_data: labelData,
      });

      // Generate HTML for all labels
      const labelHTMLs = await Promise.all(
        Array(parseInt(quantity)).fill(null).map(() => generateLabelHTML(labelData))
      );

      const allLabelsHTML = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <style>
            @page {
              size: 4in 3in;
              margin: 0.2in;
            }
            body {
              margin: 0;
              padding: 0;
            }
            .page-break {
              page-break-after: always;
            }
          </style>
        </head>
        <body>
          ${labelHTMLs.map((html, index) => `
            <div class="${index < labelHTMLs.length - 1 ? 'page-break' : ''}">
              ${html.match(/<body>([\s\S]*)<\/body>/)?.[1] || ''}
            </div>
          `).join('')}
        </body>
        </html>
      `;

      await printLabels(allLabelsHTML);
      return true;
    },
    onSuccess: () => {
      toast.success(`${quantity} label(s) sent to printer`);
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to print labels');
    },
  });

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Printer className="h-8 w-8" />
          Label Printer
        </h1>
        <p className="text-muted-foreground mt-1">Print barcode labels for products and packaging</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Label Configuration</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Label Type</Label>
              <Select value={labelType} onValueChange={(value: any) => {
                setLabelType(value);
                setSelectedItem('');
              }}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="finished_product">Finished Product</SelectItem>
                  <SelectItem value="raw_material">Raw Material</SelectItem>
                  <SelectItem value="packaging">Packaging Item</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Select Item</Label>
              <Select value={selectedItem} onValueChange={setSelectedItem}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose an item" />
                </SelectTrigger>
                <SelectContent>
                  {labelType === 'packaging' ? (
                    packagingItems?.map((item) => (
                      <SelectItem key={item.id} value={item.id}>
                        {item.name} ({item.sku})
                      </SelectItem>
                    ))
                  ) : (
                    products?.map((product) => (
                      <SelectItem key={product.id} value={product.id}>
                        {product.name} ({product.sku})
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Quantity</Label>
              <Input
                type="number"
                min="1"
                max="100"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                placeholder="Number of labels"
              />
            </div>

            <div className="space-y-3 pt-4 border-t">
              <div className="flex items-center justify-between">
                <Label htmlFor="include-barcode">Include Barcode</Label>
                <Switch
                  id="include-barcode"
                  checked={labelOptions.includeBarcode}
                  onCheckedChange={(checked) => setLabelOptions({ ...labelOptions, includeBarcode: checked })}
                />
              </div>

              <div className="flex items-center justify-between">
                <Label htmlFor="include-price">Include Price</Label>
                <Switch
                  id="include-price"
                  checked={labelOptions.includePrice}
                  onCheckedChange={(checked) => setLabelOptions({ ...labelOptions, includePrice: checked })}
                />
              </div>

              <div className="flex items-center justify-between">
                <Label htmlFor="include-batch">Include Batch Info</Label>
                <Switch
                  id="include-batch"
                  checked={labelOptions.includeBatchInfo}
                  onCheckedChange={(checked) => setLabelOptions({ ...labelOptions, includeBatchInfo: checked })}
                />
              </div>

              <div className="flex items-center justify-between">
                <Label htmlFor="include-expiry">Include Expiry Date</Label>
                <Switch
                  id="include-expiry"
                  checked={labelOptions.includeExpiryDate}
                  onCheckedChange={(checked) => setLabelOptions({ ...labelOptions, includeExpiryDate: checked })}
                />
              </div>
            </div>

            <Button
              className="w-full"
              onClick={() => printMutation.mutate()}
              disabled={!selectedItem || !quantity || printMutation.isPending}
            >
              {printMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              <Printer className="mr-2 h-4 w-4" />
              Print {quantity} Label{parseInt(quantity) > 1 ? 's' : ''}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Label Preview</CardTitle>
          </CardHeader>
          <CardContent>
            {selectedItemData ? (
              <div className="border rounded-lg p-6 text-center space-y-3">
                <h3 className="text-xl font-bold">{selectedItemData.name}</h3>
                <p className="text-sm text-muted-foreground">SKU: {selectedItemData.sku}</p>
                
                {labelOptions.includeBarcode && selectedItemData.barcode && (
                  <div className="bg-muted p-4 rounded">
                    <div className="text-xs text-muted-foreground mb-2">Barcode: {selectedItemData.barcode}</div>
                    <div className="h-16 flex items-center justify-center bg-white">
                      <div className="text-xs">Barcode preview</div>
                    </div>
                  </div>
                )}

                {labelOptions.includePrice && (
                  <p className="text-lg font-bold">
                    Rs. {(labelType === 'packaging' ? (selectedItemData as any).cost : (selectedItemData as any).price)?.toFixed(2)}
                  </p>
                )}

                <p className="text-xs text-muted-foreground">
                  This is a preview. Actual labels will be formatted for printing.
                </p>
              </div>
            ) : (
              <p className="text-center text-muted-foreground py-8">
                Select an item to preview the label
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
