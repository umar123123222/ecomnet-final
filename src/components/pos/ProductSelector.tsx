import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Search, Plus, ScanBarcode } from 'lucide-react';
import { Product } from '@/types/inventory';
import { BarcodeScanner } from '@/components/barcode/BarcodeScanner';
import type { ScanResult } from '@/components/barcode/BarcodeScanner';

interface ProductSelectorProps {
  outletId: string;
  onAddToCart: (product: any, quantity: number) => void;
}

const ProductSelector = ({ outletId, onAddToCart }: ProductSelectorProps) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [scannerOpen, setScannerOpen] = useState(false);

  const { data: products, isLoading } = useQuery({
    queryKey: ['pos-products', outletId, searchQuery],
    queryFn: async () => {
      let query = supabase
        .from('inventory')
        .select(`
          *,
          product:products(*)
        `)
        .eq('outlet_id', outletId)
        .gt('available_quantity', 0);

      if (searchQuery) {
        query = query.or(`product.name.ilike.%${searchQuery}%,product.sku.ilike.%${searchQuery}%`);
      }

      const { data, error } = await query.limit(50);
      if (error) throw error;
      
      return data?.map(inv => ({
        ...inv.product,
        available_quantity: inv.available_quantity,
      })) || [];
    },
  });

  const handleQuickAdd = (product: any) => {
    onAddToCart(product, 1);
  };

  const handleScanResult = (result: ScanResult) => {
    if (result.productId) {
      const product = products?.find(p => p.id === result.productId);
      if (product) {
        onAddToCart(product, 1);
        setScannerOpen(false);
      }
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
          <Input
            placeholder="Search products by name or SKU..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <Button onClick={() => setScannerOpen(true)} variant="outline">
          <ScanBarcode className="h-4 w-4" />
        </Button>
      </div>

      {isLoading ? (
        <div className="text-center py-8 text-muted-foreground">Loading products...</div>
      ) : products?.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">No products found</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {products?.map((product) => (
            <Card key={product.id} className="p-4 hover:shadow-md transition-shadow">
              <div className="space-y-2">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h3 className="font-semibold line-clamp-1">{product.name}</h3>
                    <p className="text-sm text-muted-foreground">{product.sku}</p>
                  </div>
                  <Badge variant={product.available_quantity > 10 ? 'default' : 'destructive'}>
                    {product.available_quantity}
                  </Badge>
                </div>
                
                <div className="flex items-center justify-between">
                  <p className="text-lg font-bold">${Number(product.price).toFixed(2)}</p>
                  <Button 
                    size="sm" 
                    onClick={() => handleQuickAdd(product)}
                    disabled={product.available_quantity === 0}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <BarcodeScanner
        isOpen={scannerOpen}
        onClose={() => setScannerOpen(false)}
        onScan={handleScanResult}
        scanType="product"
        title="Scan Product Barcode"
        outletId={outletId}
      />
    </div>
  );
};

export default ProductSelector;
