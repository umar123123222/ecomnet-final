import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Truck, TrendingUp, Clock, CheckCircle } from "lucide-react";

const CourierPerformanceWidget = () => {
  const { data: courierStats = [] } = useQuery({
    queryKey: ["courier-performance"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("dispatches")
        .select("courier, status, created_at, updated_at");

      if (error) throw error;

      // Aggregate stats by courier
      const statsByCourier = data.reduce((acc: any, dispatch: any) => {
        const courier = dispatch.courier || "unknown";
        if (!acc[courier]) {
          acc[courier] = {
            courier,
            total: 0,
            pending: 0,
            inTransit: 0,
            delivered: 0,
            avgDeliveryTime: [],
          };
        }

        acc[courier].total++;
        
        switch (dispatch.status) {
          case "pending":
            acc[courier].pending++;
            break;
          case "in_transit":
            acc[courier].inTransit++;
            break;
          case "completed":
          case "delivered":
            acc[courier].delivered++;
            // Calculate delivery time if applicable
            if (dispatch.updated_at && dispatch.created_at) {
              const created = new Date(dispatch.created_at);
              const updated = new Date(dispatch.updated_at);
              const diffDays = Math.floor((updated.getTime() - created.getTime()) / (1000 * 60 * 60 * 24));
              acc[courier].avgDeliveryTime.push(diffDays);
            }
            break;
        }

        return acc;
      }, {});

      // Calculate averages and format data
      return Object.values(statsByCourier).map((stat: any) => ({
        ...stat,
        successRate: stat.total > 0 ? ((stat.delivered / stat.total) * 100).toFixed(1) : 0,
        avgDeliveryDays: stat.avgDeliveryTime.length > 0
          ? (stat.avgDeliveryTime.reduce((sum: number, days: number) => sum + days, 0) / stat.avgDeliveryTime.length).toFixed(1)
          : "N/A",
      })).sort((a: any, b: any) => b.total - a.total);
    },
    refetchInterval: 60000, // Refresh every minute
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Truck className="h-5 w-5" />
          Courier Performance
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {courierStats.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              No dispatch data available
            </p>
          ) : (
            courierStats.map((courier: any) => (
              <div
                key={courier.courier}
                className="border rounded-lg p-4 space-y-3"
              >
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold capitalize">{courier.courier}</h3>
                  <Badge variant="outline">
                    {courier.total} dispatches
                  </Badge>
                </div>
                
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-xs text-muted-foreground">Pending</p>
                      <p className="font-medium">{courier.pending}</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-blue-500" />
                    <div>
                      <p className="text-xs text-muted-foreground">In Transit</p>
                      <p className="font-medium">{courier.inTransit}</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    <div>
                      <p className="text-xs text-muted-foreground">Delivered</p>
                      <p className="font-medium">{courier.delivered}</p>
                    </div>
                  </div>
                  
                  <div>
                    <p className="text-xs text-muted-foreground">Success Rate</p>
                    <p className="font-medium text-green-600">{courier.successRate}%</p>
                  </div>
                </div>
                
                <div className="pt-2 border-t">
                  <p className="text-xs text-muted-foreground">Avg Delivery Time</p>
                  <p className="font-medium">
                    {courier.avgDeliveryDays !== "N/A" 
                      ? `${courier.avgDeliveryDays} days` 
                      : "N/A"}
                  </p>
                </div>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default CourierPerformanceWidget;