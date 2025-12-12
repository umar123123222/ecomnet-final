import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Truck, TrendingUp, Clock, CheckCircle } from "lucide-react";
const CourierPerformanceWidget = () => {
  const {
    data: courierStats = []
  } = useQuery({
    queryKey: ["courier-performance"],
    queryFn: async () => {
      const {
        data,
        error
      } = await supabase.from("dispatches").select("courier, status, created_at, updated_at");
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
            avgDeliveryTime: []
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
        successRate: stat.total > 0 ? (stat.delivered / stat.total * 100).toFixed(1) : 0,
        avgDeliveryDays: stat.avgDeliveryTime.length > 0 ? (stat.avgDeliveryTime.reduce((sum: number, days: number) => sum + days, 0) / stat.avgDeliveryTime.length).toFixed(1) : "N/A"
      })).sort((a: any, b: any) => b.total - a.total);
    },
    refetchInterval: 300000 // Refresh every 5 minutes (reduced from 1 min)
  });
  return;
};
export default CourierPerformanceWidget;