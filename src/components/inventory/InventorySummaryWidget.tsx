import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Package, AlertTriangle, TrendingUp, ArrowRight, Loader2 } from "lucide-react";
import { Link } from "react-router-dom";
import { Inventory } from "@/types/inventory";

export function InventorySummaryWidget() {
  const { data: inventory, isLoading } = useQuery<Inventory[]>({
    queryKey: ["inventory-summary"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("inventory" as any)
        .select(`
          *,
          product:products_new(*),
          outlet:outlets(*)
        `);

      if (error) throw error;
      return data as unknown as Inventory[];
    },
    refetchInterval: 60000, // Refresh every minute
  });

  const totalItems = inventory?.reduce((sum, item) => sum + item.quantity, 0) || 0;
  const totalValue = inventory?.reduce((sum, item) => 
    sum + (item.quantity * (item.product?.price || 0)), 0) || 0;
  const lowStockCount = inventory?.filter(item => 
    item.available_quantity <= (item.product?.reorder_level || 0)).length || 0;
  const totalProducts = new Set(inventory?.map(item => item.product_id)).size;

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5 text-purple-500" />
            Inventory Overview
          </CardTitle>
        </CardHeader>
        <CardContent className="flex justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-purple-500" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-950/20 dark:to-pink-950/20 border-purple-200">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5 text-purple-500" />
              Inventory Overview
            </CardTitle>
            <CardDescription>Real-time inventory summary</CardDescription>
          </div>
          <Link to="/inventory">
            <Button variant="ghost" size="sm" className="gap-1">
              View All
              <ArrowRight className="h-3 w-3" />
            </Button>
          </Link>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="space-y-1">
            <div className="text-sm text-muted-foreground flex items-center gap-1">
              <Package className="h-3 w-3" />
              Total Items
            </div>
            <div className="text-2xl font-bold">{totalItems.toLocaleString()}</div>
          </div>

          <div className="space-y-1">
            <div className="text-sm text-muted-foreground flex items-center gap-1">
              <TrendingUp className="h-3 w-3" />
              Total Value
            </div>
            <div className="text-2xl font-bold">Rs. {Math.round(totalValue / 1000)}K</div>
          </div>

          <div className="space-y-1">
            <div className="text-sm text-muted-foreground flex items-center gap-1">
              <Package className="h-3 w-3" />
              Products
            </div>
            <div className="text-2xl font-bold">{totalProducts}</div>
          </div>

          <div className="space-y-1">
            <div className="text-sm text-muted-foreground flex items-center gap-1">
              <AlertTriangle className="h-3 w-3 text-orange-500" />
              Low Stock
            </div>
            <div className="flex items-center gap-2">
              <div className="text-2xl font-bold text-orange-500">{lowStockCount}</div>
              {lowStockCount > 0 && (
                <Badge variant="destructive" className="text-xs animate-pulse">
                  Alert
                </Badge>
              )}
            </div>
          </div>
        </div>

        {lowStockCount > 0 && (
          <div className="mt-4 p-3 bg-orange-50 dark:bg-orange-950/20 border border-orange-200 rounded-lg">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-orange-500" />
                <span className="text-sm font-medium text-orange-700 dark:text-orange-300">
                  {lowStockCount} {lowStockCount === 1 ? "item needs" : "items need"} reordering
                </span>
              </div>
              <Link to="/inventory">
                <Button size="sm" variant="outline" className="border-orange-300 text-orange-700 hover:bg-orange-100">
                  Review
                </Button>
              </Link>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
