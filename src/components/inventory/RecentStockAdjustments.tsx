import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { TrendingUp, TrendingDown, Package, Clock } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

export function RecentStockAdjustments() {
  const { data: movements, isLoading } = useQuery({
    queryKey: ["recent-stock-movements"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("stock_movements")
        .select(`
          id,
          quantity,
          movement_type,
          notes,
          created_at,
          product:products(name, sku),
          outlet:outlets(name),
          performed_by_profile:profiles!stock_movements_performed_by_fkey(full_name)
        `)
        .eq("movement_type", "adjustment")
        .order("created_at", { ascending: false })
        .limit(10);

      if (error) throw error;
      return data;
    },
  });

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <div>
          <CardTitle className="text-xl font-bold">Recent Stock Adjustments</CardTitle>
          <CardDescription>Last 10 manual stock adjustments</CardDescription>
        </div>
        <Link to="/stock-movement-history">
          <Button variant="outline" size="sm">
            View All
          </Button>
        </Link>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[400px] pr-4">
          {isLoading ? (
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : movements && movements.length > 0 ? (
            <div className="space-y-3">
              {movements.map((movement: any) => {
                const isIncrease = movement.quantity > 0;
                return (
                  <div
                    key={movement.id}
                    className="flex items-start gap-3 p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
                  >
                    <div className={`p-2 rounded-full ${isIncrease ? 'bg-success/10' : 'bg-destructive/10'}`}>
                      {isIncrease ? (
                        <TrendingUp className="h-4 w-4 text-success" />
                      ) : (
                        <TrendingDown className="h-4 w-4 text-destructive" />
                      )}
                    </div>
                    
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center justify-between">
                        <p className="font-medium text-sm">
                          {movement.product?.name || "Unknown Product"}
                        </p>
                        <Badge variant={isIncrease ? "default" : "secondary"}>
                          {isIncrease ? "+" : ""}{movement.quantity} units
                        </Badge>
                      </div>
                      
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Package className="h-3 w-3" />
                        <span>{movement.product?.sku}</span>
                        <span>•</span>
                        <span>{movement.outlet?.name}</span>
                      </div>
                      
                      {movement.notes && (
                        <p className="text-xs text-muted-foreground line-clamp-1">
                          {movement.notes}
                        </p>
                      )}
                      
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        <span>
                          {formatDistanceToNow(new Date(movement.created_at), { addSuffix: true })}
                        </span>
                        {movement.performed_by_profile?.full_name && (
                          <>
                            <span>by</span>
                            <span className="font-medium">
                              {movement.performed_by_profile.full_name}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-40 text-center">
              <Package className="h-12 w-12 text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">No recent stock adjustments</p>
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
