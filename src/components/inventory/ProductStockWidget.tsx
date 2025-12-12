import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { Package, TrendingUp, AlertCircle, Lock } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export function ProductStockWidget() {
  const { data: stockSummary, isLoading } = useQuery({
    queryKey: ['product-stock-summary'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('product_stock_summary')
        .select('*')
        .order('total_stock', { ascending: false })
        .limit(10);
      
      if (error) throw error;
      return data;
    },
    refetchInterval: 120000, // Reduced from 30s
  });

  const { data: totals } = useQuery({
    queryKey: ['inventory-totals'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('product_stock_summary')
        .select('total_stock, committed_stock, available_stock, total_value');
      
      if (error) throw error;
      
      const totalStock = data.reduce((sum, item) => sum + (item.total_stock || 0), 0);
      const totalCommitted = data.reduce((sum, item) => sum + (item.committed_stock || 0), 0);
      const totalAvailable = data.reduce((sum, item) => sum + (item.available_stock || 0), 0);
      const totalValue = data.reduce((sum, item) => sum + (item.total_value || 0), 0);
      
      return { totalStock, totalCommitted, totalAvailable, totalValue };
    },
    refetchInterval: 120000, // Reduced from 30s
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Product Stock Overview</CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-32 w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Package className="h-5 w-5" />
          Product Stock Overview
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Summary Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">Total Stock</p>
            <p className="text-2xl font-bold">{totals?.totalStock || 0}</p>
          </div>
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground flex items-center gap-1">
              <Lock className="h-3 w-3" />
              Reserved
            </p>
            <p className="text-2xl font-bold text-orange-600">{totals?.totalCommitted || 0}</p>
          </div>
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">Available</p>
            <p className="text-2xl font-bold text-green-600">{totals?.totalAvailable || 0}</p>
          </div>
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">Total Value</p>
            <p className="text-2xl font-bold">Rs {totals?.totalValue?.toFixed(0) || 0}</p>
          </div>
        </div>

        {/* Top Products */}
        <div className="space-y-2">
          <h4 className="text-sm font-medium flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            Top Products by Stock
          </h4>
          <div className="space-y-2">
            {stockSummary?.slice(0, 5).map((product) => (
              <div key={product.product_id} className="flex items-center justify-between p-2 rounded-lg bg-muted/50">
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">{product.name}</p>
                  <p className="text-xs text-muted-foreground">{product.sku}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-xs">
                    {product.available_stock} / {product.total_stock}
                  </Badge>
                  {product.available_stock === 0 && (
                    <AlertCircle className="h-4 w-4 text-destructive" />
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
