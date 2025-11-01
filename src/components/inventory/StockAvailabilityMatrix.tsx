import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Grid3x3, CheckCircle, XCircle, AlertCircle, Loader2 } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useState } from "react";

interface StockAvailability {
  product_id: string;
  product_name: string;
  product_sku: string;
  outlets: Record<string, { quantity: number; status: 'in-stock' | 'low-stock' | 'out-of-stock' }>;
}

export function StockAvailabilityMatrix() {
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  const { data: availabilityData, isLoading } = useQuery({
    queryKey: ['stock-availability-matrix', selectedCategory],
    queryFn: async () => {
      // Get all active outlets
      const { data: outlets } = await supabase
        .from('outlets')
        .select('id, name')
        .eq('is_active', true)
        .order('name');

      if (!outlets || outlets.length === 0) return null;

      // Get products with inventory across outlets
      let query = supabase
        .from('products')
        .select(`
          id,
          name,
          sku,
          category,
          reorder_level
        `)
        .eq('is_active', true)
        .order('name')
        .limit(15);

      if (selectedCategory !== 'all') {
        query = query.eq('category', selectedCategory);
      }

      const { data: products } = await query;

      if (!products) return null;

      const availabilityMatrix: StockAvailability[] = [];

      for (const product of products) {
        const outletStock: Record<string, { quantity: number; status: 'in-stock' | 'low-stock' | 'out-of-stock' }> = {};

        for (const outlet of outlets) {
          const { data: inventory } = await supabase
            .from('inventory')
            .select('quantity')
            .eq('product_id', product.id)
            .eq('outlet_id', outlet.id)
            .maybeSingle();

          const quantity = inventory?.quantity || 0;
          let status: 'in-stock' | 'low-stock' | 'out-of-stock' = 'out-of-stock';

          if (quantity > product.reorder_level) status = 'in-stock';
          else if (quantity > 0) status = 'low-stock';

          outletStock[outlet.id] = { quantity, status };
        }

        availabilityMatrix.push({
          product_id: product.id,
          product_name: product.name,
          product_sku: product.sku,
          outlets: outletStock,
        });
      }

      return { outlets, matrix: availabilityMatrix };
    },
    staleTime: 300000, // 5 minutes
  });

  const { data: categories } = useQuery({
    queryKey: ['product-categories'],
    queryFn: async () => {
      const { data } = await supabase
        .from('products')
        .select('category')
        .not('category', 'is', null)
        .order('category');

      const uniqueCategories = [...new Set(data?.map(p => p.category).filter(Boolean))];
      return uniqueCategories as string[];
    },
  });

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'in-stock':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'low-stock':
        return <AlertCircle className="h-4 w-4 text-orange-500" />;
      case 'out-of-stock':
        return <XCircle className="h-4 w-4 text-red-500" />;
      default:
        return null;
    }
  };

  const getStatusBg = (status: string) => {
    switch (status) {
      case 'in-stock':
        return 'bg-green-100 dark:bg-green-900/20';
      case 'low-stock':
        return 'bg-orange-100 dark:bg-orange-900/20';
      case 'out-of-stock':
        return 'bg-red-100 dark:bg-red-900/20';
      default:
        return '';
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Grid3x3 className="h-5 w-5" />
            Stock Availability Matrix
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!availabilityData) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Grid3x3 className="h-5 w-5" />
            Stock Availability Matrix
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
            <Grid3x3 className="h-12 w-12 mb-2 opacity-50" />
            <p className="text-sm">No inventory data available</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Grid3x3 className="h-5 w-5" />
            Stock Availability Matrix
          </CardTitle>
          <Select value={selectedCategory} onValueChange={setSelectedCategory}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {categories?.map((cat) => (
                <SelectItem key={cat} value={cat}>
                  {cat}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <p className="text-sm text-muted-foreground">
          Product availability across all outlets
        </p>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <div className="min-w-max">
            {/* Header Row */}
            <div className="flex gap-2 mb-2 pb-2 border-b">
              <div className="w-48 font-medium text-sm">Product</div>
              {availabilityData.outlets.map((outlet) => (
                <div key={outlet.id} className="w-24 text-center">
                  <Badge variant="outline" className="text-xs">
                    {outlet.name}
                  </Badge>
                </div>
              ))}
            </div>

            {/* Product Rows */}
            <div className="space-y-2">
              {availabilityData.matrix.map((item) => (
                <div key={item.product_id} className="flex gap-2 items-center">
                  <div className="w-48">
                    <p className="text-sm font-medium truncate">{item.product_name}</p>
                    <p className="text-xs text-muted-foreground">{item.product_sku}</p>
                  </div>
                  {availabilityData.outlets.map((outlet) => {
                    const stock = item.outlets[outlet.id];
                    return (
                      <div
                        key={outlet.id}
                        className={`w-24 p-2 rounded text-center ${getStatusBg(stock.status)}`}
                      >
                        <div className="flex items-center justify-center mb-1">
                          {getStatusIcon(stock.status)}
                        </div>
                        <p className="text-xs font-medium">{stock.quantity}</p>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>

            {/* Legend */}
            <div className="flex gap-4 mt-4 pt-4 border-t text-xs">
              <div className="flex items-center gap-1">
                <CheckCircle className="h-3 w-3 text-green-500" />
                <span>In Stock</span>
              </div>
              <div className="flex items-center gap-1">
                <AlertCircle className="h-3 w-3 text-orange-500" />
                <span>Low Stock</span>
              </div>
              <div className="flex items-center gap-1">
                <XCircle className="h-3 w-3 text-red-500" />
                <span>Out of Stock</span>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
