import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertTriangle, Package, TrendingDown } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';

export const PackagingLowStockAlerts = () => {
  const { data: lowStockItems, isLoading } = useQuery({
    queryKey: ['packaging-low-stock'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('packaging_items')
        .select('id, name, sku, type, cost, current_stock, reorder_level')
        .eq('is_active', true)
        .order('current_stock', { ascending: true });

      if (error) throw error;

      // Filter for items at or below reorder level
      return data.filter(
        (item) => item.current_stock <= item.reorder_level
      );
    },
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5" />
            Packaging Low Stock Alerts
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-32 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (!lowStockItems || lowStockItems.length === 0) {
    return (
      <Alert>
        <Package className="h-4 w-4" />
        <AlertTitle>All packaging items well stocked</AlertTitle>
        <AlertDescription>
          No packaging items require immediate attention.
        </AlertDescription>
      </Alert>
    );
  }

  const criticalItems = lowStockItems.filter(
    (item) => item.current_stock <= item.reorder_level * 0.5
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            Packaging Low Stock Alerts
          </span>
          <Badge variant="destructive">{lowStockItems.length} items</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {criticalItems.length > 0 && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Critical: {criticalItems.length} items</AlertTitle>
            <AlertDescription>
              These items are at 50% or below their reorder level
            </AlertDescription>
          </Alert>
        )}

        <div className="space-y-2">
          {lowStockItems.map((item) => {
            const isCritical = item.current_stock <= item.reorder_level * 0.5;
            const stockPercentage = (item.current_stock / item.reorder_level) * 100;

            return (
              <div
                key={item.id}
                className={`p-4 rounded-lg border ${
                  isCritical ? 'border-destructive bg-destructive/5' : 'border-border'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="space-y-1 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-medium">{item.name}</p>
                      {isCritical && (
                        <Badge variant="destructive" className="gap-1">
                          <TrendingDown className="h-3 w-3" />
                          Critical
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <span>SKU: {item.sku}</span>
                      <span>Type: {item.type}</span>
                      <span>Cost: PKR {item.cost}</span>
                    </div>
                    <div className="flex items-center gap-4 text-sm">
                      <span className="text-muted-foreground">
                        Current: <span className="font-medium text-foreground">{item.current_stock}</span>
                      </span>
                      <span className="text-muted-foreground">
                        Reorder Level:{' '}
                        <span className="font-medium text-foreground">
                          {item.reorder_level}
                        </span>
                      </span>
                      <span className="text-muted-foreground">
                        Stock: <span className="font-medium text-foreground">{stockPercentage.toFixed(0)}%</span>
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
};
