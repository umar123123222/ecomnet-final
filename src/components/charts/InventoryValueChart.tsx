import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Loader2 } from "lucide-react";

export const InventoryValueChart = () => {
  const { data: inventoryValue, isLoading } = useQuery({
    queryKey: ["inventory-value"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("inventory")
        .select(`
          *,
          product:products(price, name),
          outlet:outlets(name)
        `);

      if (error) throw error;

      // Group by outlet and calculate total value
      const grouped = data.reduce((acc: any[], curr: any) => {
        const existing = acc.find((item) => item.name === curr.outlet?.name);
        const value = (curr.quantity || 0) * (curr.product?.price || 0);
        
        if (existing) {
          existing.value += value;
        } else {
          acc.push({
            name: curr.outlet?.name || "Unknown",
            value: value,
          });
        }
        return acc;
      }, []);

      return grouped.sort((a, b) => b.value - a.value);
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[300px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!inventoryValue || inventoryValue.length === 0) {
    return (
      <div className="flex items-center justify-center h-[300px] text-muted-foreground">
        No inventory value data available
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={300}>
      <AreaChart data={inventoryValue}>
        <defs>
          <linearGradient id="valueGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="hsl(var(--chart-1))" stopOpacity={0.8} />
            <stop offset="95%" stopColor="hsl(var(--chart-1))" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
        <XAxis 
          dataKey="name" 
          className="text-xs"
          tick={{ fill: 'hsl(var(--muted-foreground))' }}
        />
        <YAxis 
          className="text-xs"
          tick={{ fill: 'hsl(var(--muted-foreground))' }}
          tickFormatter={(value) => `Rs. ${(value / 1000).toFixed(0)}k`}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: 'hsl(var(--background))',
            border: '1px solid hsl(var(--border))',
            borderRadius: '6px',
          }}
          formatter={(value: any) => [`Rs. ${value.toLocaleString()}`, 'Total Value']}
        />
        <Area
          type="monotone"
          dataKey="value"
          stroke="hsl(var(--chart-1))"
          fillOpacity={1}
          fill="url(#valueGradient)"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
};
