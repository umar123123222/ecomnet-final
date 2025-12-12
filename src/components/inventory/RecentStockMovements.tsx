import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowUpCircle, ArrowDownCircle, ArrowRightLeft, RotateCcw, Package, Loader2 } from "lucide-react";
import { format } from "date-fns";

export function RecentStockMovements() {
  const { data: movements, isLoading } = useQuery({
    queryKey: ["recent-stock-movements"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("stock_movements" as any)
        .select(`
          *,
          product:products(name, sku),
          outlet:outlets(name)
        `)
        .order("created_at", { ascending: false })
        .limit(10);

      if (error) throw error;
      return data;
    },
    refetchInterval: 120000, // Reduced from 30s to 2 minutes
  });

  const getMovementIcon = (type: string) => {
    switch (type) {
      case "purchase":
      case "transfer_in":
        return <ArrowUpCircle className="h-4 w-4 text-green-500" />;
      case "sale":
      case "transfer_out":
        return <ArrowDownCircle className="h-4 w-4 text-red-500" />;
      case "return":
        return <RotateCcw className="h-4 w-4 text-blue-500" />;
      case "adjustment":
        return <ArrowRightLeft className="h-4 w-4 text-orange-500" />;
      default:
        return <Package className="h-4 w-4 text-gray-500" />;
    }
  };

  const getMovementColor = (type: string) => {
    switch (type) {
      case "purchase":
      case "transfer_in":
        return "border-green-500 text-green-700 bg-green-50";
      case "sale":
      case "transfer_out":
        return "border-red-500 text-red-700 bg-red-50";
      case "return":
        return "border-blue-500 text-blue-700 bg-blue-50";
      case "adjustment":
        return "border-orange-500 text-orange-700 bg-orange-50";
      default:
        return "border-gray-500 text-gray-700 bg-gray-50";
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Recent Stock Movements</CardTitle>
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
        <CardTitle>Recent Stock Movements</CardTitle>
        <CardDescription>Latest inventory transactions</CardDescription>
      </CardHeader>
      <CardContent>
        {!movements || movements.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Package className="h-12 w-12 mx-auto mb-2 opacity-50" />
            <p>No recent movements</p>
          </div>
        ) : (
          <div className="space-y-2">
            {movements.map((movement: any) => (
              <div
                key={movement.id}
                className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-center gap-3 flex-1">
                  <div className="flex-shrink-0">
                    {getMovementIcon(movement.movement_type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm truncate">
                      {movement.product?.name}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {movement.outlet?.name} • {format(new Date(movement.created_at), "MMM dd, hh:mm a")}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className={`${getMovementColor(movement.movement_type)} capitalize text-xs`}>
                    {movement.movement_type.replace("_", " ")}
                  </Badge>
                  <div className={`font-semibold text-sm ${movement.quantity > 0 ? "text-green-600" : "text-red-600"}`}>
                    {movement.quantity > 0 ? "+" : ""}{movement.quantity}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
