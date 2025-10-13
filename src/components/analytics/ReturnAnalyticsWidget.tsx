import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TrendingDown, Package, AlertTriangle } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';

interface ReturnAnalytics {
  totalReturns: number;
  returnRate: number;
  topReasons: Array<{ reason: string; count: number }>;
  trendData: Array<{ date: string; returns: number }>;
  highReturnProducts: Array<{ productName: string; returnCount: number; returnRate: number }>;
}

const COLORS = ['#ef4444', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6'];

const ReturnAnalyticsWidget = () => {
  const { data: analytics, isLoading } = useQuery({
    queryKey: ['return-analytics'],
    queryFn: async () => {
      // Fetch returns
      const { data: returns, error } = await supabase
        .from('returns')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Fetch total orders for return rate calculation
      const { count: totalOrders } = await supabase
        .from('orders')
        .select('*', { count: 'exact', head: true });

      // Calculate return reasons
      const reasons = returns.reduce((acc: Record<string, number>, ret) => {
        const reason = ret.reason || 'No reason specified';
        acc[reason] = (acc[reason] || 0) + 1;
        return acc;
      }, {});

      const topReasons = Object.entries(reasons)
        .map(([reason, count]) => ({ reason, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);

      // Calculate trend data (last 7 days)
      const last7Days = Array.from({ length: 7 }, (_, i) => {
        const date = new Date();
        date.setDate(date.getDate() - (6 - i));
        return date.toISOString().split('T')[0];
      });

      const trendData = last7Days.map(date => ({
        date,
        returns: returns.filter(r => r.created_at.startsWith(date)).length
      }));

      // Simplified: just count products that appear frequently in returns
      // For a production version, you'd want to track product IDs properly
      const highRiskCount = returns.filter(r => (r.worth || 0) > 5000).length;

      return {
        totalReturns: returns.length,
        returnRate: totalOrders ? (returns.length / totalOrders) * 100 : 0,
        topReasons,
        trendData,
        highValueReturns: highRiskCount
      } as any;
    }
  });

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          Loading return analytics...
        </CardContent>
      </Card>
    );
  }

  if (!analytics) return null;

  return (
    <div className="space-y-4">
      {/* Return Rate Summary */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <TrendingDown className="h-4 w-4" />
              Overall Return Rate
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-red-600">{analytics.returnRate.toFixed(2)}%</div>
            <p className="text-sm text-muted-foreground mt-1">
              {analytics.totalReturns} total returns
            </p>
          </CardContent>
        </Card>

        {analytics.highValueReturns > 0 && (
          <Card className="border-red-200 dark:border-red-900">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-red-600" />
                High Value Returns
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-red-600">{analytics.highValueReturns}</div>
              <p className="text-sm text-muted-foreground mt-1">
                Returns worth &gt;PKR 5,000
              </p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Return Reasons */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Top Return Reasons</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie
                  data={analytics.topReasons}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={(entry) => `${entry.reason}: ${entry.count}`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="count"
                >
                  {analytics.topReasons.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Return Trend (Last 7 Days)</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={analytics.trendData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" tickFormatter={(value) => new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} />
                <YAxis />
                <Tooltip />
                <Bar dataKey="returns" fill="#ef4444" name="Returns" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default ReturnAnalyticsWidget;
