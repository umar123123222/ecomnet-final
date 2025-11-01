import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Package, AlertTriangle, TrendingDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import { Skeleton } from '@/components/ui/skeleton';

export const PackagingInventoryWidget = () => {
  const { data: packagingItems, isLoading } = useQuery({
    queryKey: ['packaging-inventory-summary'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('packaging_items')
        .select('*')
        .eq('is_active', true)
        .order('current_stock', { ascending: true });

      if (error) throw error;
      return data;
    },
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Packaging Inventory
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </CardContent>
      </Card>
    );
  }

  const lowStockItems = packagingItems?.filter(
    (item) => item.current_stock <= item.reorder_level
  ) || [];

  const criticalItems = lowStockItems.filter(
    (item) => item.current_stock <= item.reorder_level * 0.5
  );

  const totalItems = packagingItems?.length || 0;
  const totalQuantity = packagingItems?.reduce((sum, item) => sum + item.current_stock, 0) || 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Packaging Inventory
          </span>
          <Link to="/packaging-management">
            <Button variant="outline" size="sm">
              Manage
            </Button>
          </Link>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-3 gap-4">
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">Total Items</p>
            <p className="text-2xl font-bold">{totalItems}</p>
          </div>
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">Total Quantity</p>
            <p className="text-2xl font-bold">{totalQuantity.toLocaleString()}</p>
          </div>
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">Low Stock</p>
            <p className="text-2xl font-bold flex items-center gap-2">
              {lowStockItems.length}
              {lowStockItems.length > 0 && (
                <AlertTriangle className="h-4 w-4 text-destructive" />
              )}
            </p>
          </div>
        </div>

        {criticalItems.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium text-destructive">
              <AlertTriangle className="h-4 w-4" />
              Critical Stock Levels
            </div>
            <div className="space-y-2">
              {criticalItems.slice(0, 3).map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between p-2 rounded-lg bg-destructive/10"
                >
                  <div className="flex-1">
                    <p className="font-medium text-sm">
                      {item.name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {item.sku}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="destructive" className="gap-1">
                      <TrendingDown className="h-3 w-3" />
                      {item.current_stock}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {lowStockItems.length === 0 && (
          <div className="text-center py-4 text-muted-foreground text-sm">
            All packaging items are well stocked
          </div>
        )}
      </CardContent>
    </Card>
  );
};
