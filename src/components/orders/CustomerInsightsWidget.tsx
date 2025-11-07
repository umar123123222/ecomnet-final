import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { TrendingUp, Package, Calendar, RotateCcw, AlertTriangle, DollarSign } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { format } from "date-fns";

interface CustomerInsightsWidgetProps {
  customerId: string | null;
  customerName?: string;
}

export const CustomerInsightsWidget = ({ customerId, customerName }: CustomerInsightsWidgetProps) => {
  const { data: customer, isLoading: customerLoading } = useQuery({
    queryKey: ['customer-details', customerId],
    queryFn: async () => {
      if (!customerId) return null;
      const { data, error } = await supabase
        .from('customers')
        .select('*')
        .eq('id', customerId)
        .single();
      
      if (error) throw error;
      return data;
    },
    enabled: !!customerId,
  });

  const { data: orderHistory, isLoading: ordersLoading } = useQuery({
    queryKey: ['customer-order-history', customerId],
    queryFn: async () => {
      if (!customerId) return [];
      const { data, error } = await supabase
        .from('orders')
        .select('id, total_amount, status, created_at')
        .eq('customer_id', customerId)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data;
    },
    enabled: !!customerId,
  });

  if (!customerId) {
    return (
      <Card>
        <CardContent className="pt-6 text-center text-muted-foreground">
          No customer data available
        </CardContent>
      </Card>
    );
  }

  if (customerLoading || ordersLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Customer Insights</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-40 w-full" />
        </CardContent>
      </Card>
    );
  }

  const totalOrders = orderHistory?.length || 0;
  const totalSpent = orderHistory?.reduce((sum, order) => sum + Number(order.total_amount || 0), 0) || 0;
  const avgSpend = totalOrders > 0 ? totalSpent / totalOrders : 0;
  const returnCount = customer?.return_count || 0;
  const deliveredCount = customer?.delivered_count || 0;
  const lastOrderDate = orderHistory?.[0]?.created_at;
  const riskScore = customer?.is_suspicious ? 'High' : 'Low';

  // Monthly spending trend (last 6 months)
  const monthlyData = Array.from({ length: 6 }, (_, i) => {
    const date = new Date();
    date.setMonth(date.getMonth() - (5 - i));
    const monthKey = format(date, 'MMM');
    const monthStart = new Date(date.getFullYear(), date.getMonth(), 1);
    const monthEnd = new Date(date.getFullYear(), date.getMonth() + 1, 0);
    
    const monthTotal = orderHistory?.filter(order => {
      const orderDate = new Date(order.created_at);
      return orderDate >= monthStart && orderDate <= monthEnd;
    }).reduce((sum, order) => sum + Number(order.total_amount || 0), 0) || 0;

    return { month: monthKey, amount: monthTotal };
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Customer Insights</span>
          <Badge variant={customer?.is_suspicious ? 'destructive' : 'default'}>
            {riskScore} Risk
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Key Metrics */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <DollarSign className="h-4 w-4" />
              Lifetime Value
            </div>
            <div className="text-2xl font-bold">
              {totalSpent.toLocaleString('en-PK', { style: 'currency', currency: 'PKR', maximumFractionDigits: 0 })}
            </div>
          </div>

          <div className="space-y-1">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Package className="h-4 w-4" />
              Total Orders
            </div>
            <div className="text-2xl font-bold">{totalOrders}</div>
          </div>

          <div className="space-y-1">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <TrendingUp className="h-4 w-4" />
              Avg Spend/Order
            </div>
            <div className="text-lg font-semibold">
              {avgSpend.toLocaleString('en-PK', { style: 'currency', currency: 'PKR', maximumFractionDigits: 0 })}
            </div>
          </div>

          <div className="space-y-1">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Calendar className="h-4 w-4" />
              Last Order
            </div>
            <div className="text-sm font-medium">
              {lastOrderDate ? format(new Date(lastOrderDate), 'MMM dd, yyyy') : 'N/A'}
            </div>
          </div>
        </div>

        {/* Return History */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-medium">
              <RotateCcw className="h-4 w-4" />
              Return History
            </div>
            <Badge variant={returnCount > 2 ? 'destructive' : 'secondary'}>
              {returnCount} returns
            </Badge>
          </div>
          <div className="text-sm text-muted-foreground">
            Delivered: {deliveredCount} | Return Rate: {totalOrders > 0 ? ((returnCount / totalOrders) * 100).toFixed(1) : 0}%
          </div>
        </div>

        {/* Risk Score */}
        {customer?.is_suspicious && (
          <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
            <div className="flex items-start gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive mt-0.5" />
              <div>
                <div className="font-medium text-sm">Flagged as Suspicious</div>
                <div className="text-xs text-muted-foreground mt-1">
                  {customer.suspicious_reason || 'Multiple risk factors detected'}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Spending Trend */}
        <div className="space-y-3">
          <div className="text-sm font-medium">6-Month Spending Trend</div>
          <ResponsiveContainer width="100%" height={150}>
            <BarChart data={monthlyData}>
              <XAxis dataKey="month" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip 
                formatter={(value: number) => value.toLocaleString('en-PK', { style: 'currency', currency: 'PKR', maximumFractionDigits: 0 })}
              />
              <Bar dataKey="amount" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
};
