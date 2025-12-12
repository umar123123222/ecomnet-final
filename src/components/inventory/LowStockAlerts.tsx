import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Package, TrendingDown, Loader2 } from "lucide-react";
import { Inventory } from "@/types/inventory";

export function LowStockAlerts() {
  const { data: lowStockItems, isLoading } = useQuery<Inventory[]>({
    queryKey: ["low-stock-alerts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("inventory")
        .select(`
          *,
          product:products(*),
          outlet:outlets(*)
        `)
        .order("available_quantity", { ascending: true });

      if (error) throw error;

      const lowStock = data.filter(
        (item: any) => item.available_quantity <= (item.product?.reorder_level || 10)
      );

      return lowStock.slice(0, 10) as Inventory[];
    },
    refetchInterval: 120000, // Reduced from 30s to 2 minutes
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-orange-500" />
            Low Stock Alerts
          </CardTitle>
        </CardHeader>
        <CardContent className="flex justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-purple-500" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-orange-500 animate-pulse" />
              Low Stock Alerts
            </CardTitle>
            <CardDescription>Items that need reordering</CardDescription>
          </div>
          <Badge variant="destructive" className="text-lg px-3 py-1">
            {lowStockItems?.length || 0}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        {!lowStockItems || lowStockItems.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Package className="h-12 w-12 mx-auto mb-2 opacity-50" />
            <p>No low stock items</p>
          </div>
        ) : (
          <div className="space-y-3">
            {lowStockItems.map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between p-3 rounded-lg border border-orange-200 bg-orange-50/50 hover:bg-orange-50 transition-colors"
              >
                <div className="flex-1">
                  <div className="font-medium text-sm">{item.product?.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {item.outlet?.name} • SKU: {item.product?.sku}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <div className="flex items-center gap-1 text-orange-600 font-semibold">
                      <TrendingDown className="h-3 w-3" />
                      {item.available_quantity}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Reorder: {item.product?.reorder_level || 10}
                    </div>
                  </div>
                  <Button size="sm" variant="outline" className="h-7 text-xs">
                    Reorder
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
