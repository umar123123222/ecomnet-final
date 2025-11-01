import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Building2, TrendingUp, Package, Loader2 } from "lucide-react";
import { formatCurrency } from "@/utils/currency";
import { useCurrency } from "@/hooks/useCurrency";

interface OutletInventoryData {
  outlet_id: string;
  outlet_name: string;
  outlet_type: string;
  total_products: number;
  total_quantity: number;
  total_value: number;
  low_stock_items: number;
  out_of_stock_items: number;
}

export function OutletInventoryComparison() {
  const { currency } = useCurrency();

  const { data: outletData, isLoading } = useQuery({
    queryKey: ['outlet-inventory-comparison'],
    queryFn: async () => {
      const { data: outlets } = await supabase
        .from('outlets')
        .select('id, name, outlet_type')
        .eq('is_active', true);

      if (!outlets) return [];

      const outletStats: OutletInventoryData[] = [];

      for (const outlet of outlets) {
        const { data: inventory } = await supabase
          .from('inventory')
          .select(`
            quantity,
            product:products!inner (
              cost,
              reorder_level
            )
          `)
          .eq('outlet_id', outlet.id);

        const totalProducts = inventory?.length || 0;
        const totalQuantity = inventory?.reduce((sum, inv) => sum + inv.quantity, 0) || 0;
        const totalValue = inventory?.reduce((sum, inv) => 
          sum + (inv.quantity * (inv.product?.cost || 0)), 0
        ) || 0;

        const lowStockItems = inventory?.filter(inv => 
          inv.quantity > 0 && inv.quantity <= (inv.product?.reorder_level || 0)
        ).length || 0;

        const outOfStockItems = inventory?.filter(inv => inv.quantity === 0).length || 0;

        outletStats.push({
          outlet_id: outlet.id,
          outlet_name: outlet.name,
          outlet_type: outlet.outlet_type,
          total_products: totalProducts,
          total_quantity: totalQuantity,
          total_value: totalValue,
          low_stock_items: lowStockItems,
          out_of_stock_items: outOfStockItems,
        });
      }

      return outletStats.sort((a, b) => b.total_value - a.total_value);
    },
    staleTime: 300000, // 5 minutes
  });

  const getOutletTypeColor = (type: string) => {
    return type === 'warehouse' ? 'default' : 'secondary';
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Outlet Inventory Comparison
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

  if (!outletData || outletData.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Outlet Inventory Comparison
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
            <Building2 className="h-12 w-12 mb-2 opacity-50" />
            <p className="text-sm">No active outlets found</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const totalValue = outletData.reduce((sum, o) => sum + o.total_value, 0);
  const totalQuantity = outletData.reduce((sum, o) => sum + o.total_quantity, 0);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Outlet Inventory Comparison
          </CardTitle>
          <Badge variant="outline">{outletData.length} outlets</Badge>
        </div>
        <div className="flex gap-4 text-sm">
          <div>
            <span className="text-muted-foreground">Total Value: </span>
            <span className="font-medium">{formatCurrency(totalValue, currency)}</span>
          </div>
          <div>
            <span className="text-muted-foreground">Total Units: </span>
            <span className="font-medium">{totalQuantity.toLocaleString()}</span>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {outletData.map((outlet) => (
            <div
              key={outlet.outlet_id}
              className="p-4 border rounded-lg hover:bg-accent/50 transition-colors"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Building2 className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="font-medium">{outlet.outlet_name}</p>
                    <Badge variant={getOutletTypeColor(outlet.outlet_type)} className="mt-1">
                      {outlet.outlet_type}
                    </Badge>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-lg font-bold">{formatCurrency(outlet.total_value, currency)}</p>
                  <p className="text-xs text-muted-foreground">
                    {((outlet.total_value / totalValue) * 100).toFixed(1)}% of total
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-4 gap-3">
                <div className="text-center p-2 bg-accent/30 rounded">
                  <div className="flex items-center justify-center gap-1 mb-1">
                    <Package className="h-3 w-3" />
                    <p className="text-xs text-muted-foreground">Products</p>
                  </div>
                  <p className="text-sm font-medium">{outlet.total_products}</p>
                </div>

                <div className="text-center p-2 bg-accent/30 rounded">
                  <div className="flex items-center justify-center gap-1 mb-1">
                    <TrendingUp className="h-3 w-3" />
                    <p className="text-xs text-muted-foreground">Units</p>
                  </div>
                  <p className="text-sm font-medium">{outlet.total_quantity.toLocaleString()}</p>
                </div>

                <div className="text-center p-2 bg-orange-100 dark:bg-orange-900/20 rounded">
                  <p className="text-xs text-muted-foreground mb-1">Low Stock</p>
                  <p className="text-sm font-medium text-orange-600 dark:text-orange-400">
                    {outlet.low_stock_items}
                  </p>
                </div>

                <div className="text-center p-2 bg-red-100 dark:bg-red-900/20 rounded">
                  <p className="text-xs text-muted-foreground mb-1">Out of Stock</p>
                  <p className="text-sm font-medium text-red-600 dark:text-red-400">
                    {outlet.out_of_stock_items}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
