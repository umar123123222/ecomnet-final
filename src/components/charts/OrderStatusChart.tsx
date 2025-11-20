import { memo, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip, Legend } from "recharts";
import { Loader2 } from "lucide-react";

const COLORS = {
  pending: 'hsl(var(--chart-1))',
  booked: 'hsl(var(--chart-2))',
  dispatched: 'hsl(var(--chart-3))',
  delivered: 'hsl(var(--chart-4))',
  cancelled: 'hsl(var(--chart-5))',
};

export const OrderStatusChart = memo(() => {
  const { data: orderStatus, isLoading } = useQuery({
    queryKey: ["order-status-distribution"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("status");

      if (error) throw error;

      // Count by status
      const statusCounts = data.reduce((acc: any, curr: any) => {
        const status = curr.status || 'pending';
        acc[status] = (acc[status] || 0) + 1;
        return acc;
      }, {});

      return Object.entries(statusCounts).map(([name, value]) => ({
        name: name.charAt(0).toUpperCase() + name.slice(1),
        value,
        color: COLORS[name as keyof typeof COLORS] || COLORS.pending,
      }));
    },
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
    refetchOnMount: false,
  });

  // Memoize chart data to prevent unnecessary re-renders
  const chartData = useMemo(() => orderStatus || [], [orderStatus]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[300px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!chartData || chartData.length === 0) {
    return (
      <div className="flex items-center justify-center h-[300px] text-muted-foreground">
        No order status data available
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={300}>
      <PieChart>
        <Pie
          data={chartData}
          cx="50%"
          cy="50%"
          labelLine={false}
          label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
          outerRadius={80}
          fill="#8884d8"
          dataKey="value"
        >
          {chartData.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={entry.color} />
          ))}
        </Pie>
        <Tooltip
          contentStyle={{
            backgroundColor: 'hsl(var(--background))',
            border: '1px solid hsl(var(--border))',
            borderRadius: '6px',
          }}
        />
        <Legend />
      </PieChart>
    </ResponsiveContainer>
  );
});

OrderStatusChart.displayName = 'OrderStatusChart';
