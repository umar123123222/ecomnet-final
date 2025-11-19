import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Loader2 } from "lucide-react";

export const StaffPerformanceChart = () => {
  const { data: staffPerformance, isLoading, error } = useQuery({
    queryKey: ["staff-performance"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_performance")
        .select(`
          *,
          user:profiles!fk_user_performance_user(full_name)
        `)
        .gte("date", new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
        .order("date", { ascending: true });

      if (error) throw error;

      // Return empty array if no data
      if (!data || data.length === 0) {
        return [];
      }

      // Aggregate by user
      const aggregated = data.reduce((acc: any[], curr: any) => {
        const existing = acc.find((item) => item.name === curr.user?.full_name);
        if (existing) {
          existing.orders += curr.orders_processed || 0;
          existing.returns += curr.returns_handled || 0;
          existing.verifications += curr.addresses_verified || 0;
        } else {
          acc.push({
            name: curr.user?.full_name || "Unknown",
            orders: curr.orders_processed || 0,
            returns: curr.returns_handled || 0,
            verifications: curr.addresses_verified || 0,
          });
        }
        return acc;
      }, []);

      return aggregated;
    },
    retry: 1,
    staleTime: 5 * 60 * 1000,
    refetchInterval: false,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[300px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-[300px] text-muted-foreground">
        <p className="text-sm">Unable to load staff performance data</p>
      </div>
    );
  }

  if (!staffPerformance || staffPerformance.length === 0) {
    return (
      <div className="flex items-center justify-center h-[300px] text-muted-foreground">
        <p className="text-sm">No staff performance data available for the last 7 days</p>
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={staffPerformance}>
        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
        <XAxis 
          dataKey="name" 
          className="text-xs"
          tick={{ fill: 'hsl(var(--muted-foreground))' }}
        />
        <YAxis 
          className="text-xs"
          tick={{ fill: 'hsl(var(--muted-foreground))' }}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: 'hsl(var(--background))',
            border: '1px solid hsl(var(--border))',
            borderRadius: '6px',
          }}
        />
        <Legend />
        <Bar dataKey="orders" fill="hsl(var(--chart-1))" name="Orders Processed" />
        <Bar dataKey="returns" fill="hsl(var(--chart-2))" name="Returns Handled" />
        <Bar dataKey="verifications" fill="hsl(var(--chart-3))" name="Addresses Verified" />
      </BarChart>
    </ResponsiveContainer>
  );
};
