import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Package, AlertTriangle, TrendingDown, Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import { Skeleton } from '@/components/ui/skeleton';

export const PackagingInventoryWidget = () => {
  const { data: packagingItems, isLoading } = useQuery({
    queryKey: ['packaging-inventory-summary'],
    queryFn: async () => {
      // Fetch packaging items - select only needed fields
      const { data: items, error } = await supabase
        .from('packaging_items')
        .select('id, name, sku, current_stock, reorder_level')
        .eq('is_active', true)
        .order('current_stock', { ascending: true });

      if (error) throw error;

      // Fetch reserved quantities using RPC function
      const { data: reservedData } = await supabase.rpc('get_packaging_reservations');

      // Create a map of packaging_item_id -> reserved_count
      const reservedMap = new Map<string, number>();
      reservedData?.forEach((item: { packaging_item_id: string; reserved_count: number }) => {
        reservedMap.set(item.packaging_item_id, Number(item.reserved_count));
      });

      // Add reserved_quantity and available_quantity to each item
      return items?.map(item => {
        const reserved = reservedMap.get(item.id) || 0;
        return {
          ...item,
          reserved_quantity: reserved,
          available_quantity: item.current_stock - reserved
        };
      });
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

  // Low stock based on AVAILABLE quantity, not just current stock
  const lowStockItems = packagingItems?.filter(
    (item) => item.available_quantity <= item.reorder_level
  ) || [];

  const criticalItems = lowStockItems.filter(
    (item) => item.available_quantity <= item.reorder_level * 0.5
  );

  const totalItems = packagingItems?.length || 0;
  const totalQuantity = packagingItems?.reduce((sum, item) => sum + item.current_stock, 0) || 0;
  const totalReserved = packagingItems?.reduce((sum, item) => sum + (item.reserved_quantity || 0), 0) || 0;
  const totalAvailable = packagingItems?.reduce((sum, item) => sum + item.available_quantity, 0) || 0;

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
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">Total Items</p>
            <p className="text-2xl font-bold">{totalItems}</p>
          </div>
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">Total Stock</p>
            <p className="text-2xl font-bold">{totalQuantity.toLocaleString()}</p>
          </div>
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground flex items-center gap-1">
              <Lock className="h-3 w-3" />
              Reserved
            </p>
            <p className="text-2xl font-bold text-orange-600">{totalReserved.toLocaleString()}</p>
          </div>
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">Available</p>
            <p className="text-2xl font-bold text-green-600">{totalAvailable.toLocaleString()}</p>
          </div>
        </div>

        {criticalItems.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium text-destructive">
              <AlertTriangle className="h-4 w-4" />
              Low Available Stock
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
                    <Badge variant="outline" className="text-xs gap-1">
                      <Lock className="h-3 w-3" />
                      {item.reserved_quantity}
                    </Badge>
                    <Badge variant="destructive" className="gap-1">
                      <TrendingDown className="h-3 w-3" />
                      {item.available_quantity} avail
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