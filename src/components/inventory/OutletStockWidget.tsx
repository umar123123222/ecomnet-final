import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { Building2, Warehouse } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export function OutletStockWidget() {
  const { data: outletSummary, isLoading } = useQuery({
    queryKey: ['outlet-stock-summary'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('outlet_stock_summary')
        .select('*')
        .order('total_value', { ascending: false });
      
      if (error) throw error;
      return data;
    },
    refetchInterval: 30000,
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Outlet Stock Distribution</CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-32 w-full" />
        </CardContent>
      </Card>
    );
  }

  const warehouses = outletSummary?.filter(o => o.outlet_type === 'warehouse') || [];
  const retail = outletSummary?.filter(o => o.outlet_type === 'retail') || [];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Building2 className="h-5 w-5" />
          Outlet Stock Distribution
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Warehouses */}
        {warehouses.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium flex items-center gap-2">
              <Warehouse className="h-4 w-4" />
              Warehouses ({warehouses.length})
            </h4>
            <div className="space-y-2">
              {warehouses.map((outlet) => (
                <div key={outlet.outlet_id} className="p-3 rounded-lg border bg-card">
                  <div className="flex items-center justify-between mb-2">
                    <p className="font-medium">{outlet.outlet_name}</p>
                    <Badge variant="secondary">{outlet.product_count} products</Badge>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-sm">
                    <div>
                      <p className="text-muted-foreground">Total</p>
                      <p className="font-medium">{outlet.total_units}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Reserved</p>
                      <p className="font-medium text-orange-600">{outlet.reserved_units}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Available</p>
                      <p className="font-medium text-green-600">{outlet.available_units}</p>
                    </div>
                  </div>
                  <div className="mt-2 pt-2 border-t">
                    <p className="text-xs text-muted-foreground">Stock Value</p>
                    <p className="font-semibold">Rs {outlet.total_value?.toFixed(0) || 0}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Retail Outlets */}
        {retail.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium flex items-center gap-2">
              <Building2 className="h-4 w-4" />
              Retail Outlets ({retail.length})
            </h4>
            <div className="space-y-2">
              {retail.map((outlet) => (
                <div key={outlet.outlet_id} className="p-3 rounded-lg border bg-card">
                  <div className="flex items-center justify-between mb-2">
                    <p className="font-medium">{outlet.outlet_name}</p>
                    <Badge variant="secondary">{outlet.product_count} products</Badge>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-sm">
                    <div>
                      <p className="text-muted-foreground">Total</p>
                      <p className="font-medium">{outlet.total_units}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Reserved</p>
                      <p className="font-medium text-orange-600">{outlet.reserved_units}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Available</p>
                      <p className="font-medium text-green-600">{outlet.available_units}</p>
                    </div>
                  </div>
                  <div className="mt-2 pt-2 border-t">
                    <p className="text-xs text-muted-foreground">Stock Value</p>
                    <p className="font-semibold">Rs {outlet.total_value?.toFixed(0) || 0}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {!warehouses.length && !retail.length && (
          <p className="text-sm text-muted-foreground text-center py-8">
            No outlets with inventory found
          </p>
        )}
      </CardContent>
    </Card>
  );
}
