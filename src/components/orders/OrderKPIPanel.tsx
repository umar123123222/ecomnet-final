import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, TrendingDown, Package, MapPin, Truck, RotateCcw, Calendar } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from "recharts";

interface Order {
  id: string;
  total_amount: number;
  city: string;
  courier: string | null;
  status: string;
  created_at: string;
}

interface OrderKPIPanelProps {
  orders: Order[];
  isVisible: boolean;
}

export const OrderKPIPanel = ({ orders, isVisible }: OrderKPIPanelProps) => {
  if (!isVisible || !orders.length) return null;

  // Calculate AOV
  const totalRevenue = orders.reduce((sum, order) => sum + Number(order.total_amount || 0), 0);
  const aov = totalRevenue / orders.length;

  // Orders by City (top 5)
  const cityData = orders.reduce((acc, order) => {
    const city = order.city || "Unknown";
    acc[city] = (acc[city] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  
  const topCities = Object.entries(cityData)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)
    .map(([city, count]) => ({ city, count }));

  // Orders by Courier
  const courierData = orders.reduce((acc, order) => {
    const courier = order.courier || "Not Assigned";
    acc[courier] = (acc[courier] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  
  const courierChartData = Object.entries(courierData).map(([name, value]) => ({ name, value }));
  const COLORS = ['hsl(var(--chart-1))', 'hsl(var(--chart-2))', 'hsl(var(--chart-3))', 'hsl(var(--chart-4))', 'hsl(var(--chart-5))'];

  // Return Rate
  const returnedOrders = orders.filter(o => o.status === 'returned').length;
  const returnRate = (returnedOrders / orders.length) * 100;
  const returnTrend = returnRate < 5 ? 'down' : 'up'; // Mock trend

  // Daily Volume (last 7 days)
  const last7Days = Array.from({ length: 7 }, (_, i) => {
    const date = new Date();
    date.setDate(date.getDate() - (6 - i));
    return date.toISOString().split('T')[0];
  });

  const dailyVolumeData = last7Days.map(date => {
    const count = orders.filter(o => o.created_at?.split('T')[0] === date).length;
    return { date: new Date(date).getDate().toString(), count };
  });

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-6 animate-fade-in">
      {/* Average Order Value */}
      <Card className="border-primary/20">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Package className="h-4 w-4 text-primary" />
            Avg Order Value
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {aov.toLocaleString('en-PK', { style: 'currency', currency: 'PKR', maximumFractionDigits: 0 })}
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            From {orders.length} orders
          </p>
        </CardContent>
      </Card>

      {/* Orders by City */}
      <Card className="border-primary/20">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <MapPin className="h-4 w-4 text-primary" />
            Top Cities
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={80}>
            <BarChart data={topCities} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
              <XAxis dataKey="city" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip />
              <Bar dataKey="count" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Orders by Courier */}
      <Card className="border-primary/20">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Truck className="h-4 w-4 text-primary" />
            Courier Distribution
          </CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center">
          <ResponsiveContainer width="100%" height={80}>
            <PieChart>
              <Pie
                data={courierChartData}
                cx="50%"
                cy="50%"
                innerRadius={20}
                outerRadius={35}
                paddingAngle={2}
                dataKey="value"
              >
                {courierChartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Return Rate */}
      <Card className="border-primary/20">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <RotateCcw className="h-4 w-4 text-primary" />
            Return Rate
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2">
            <span className="text-2xl font-bold">{returnRate.toFixed(1)}%</span>
            <Badge variant={returnTrend === 'down' ? 'success' : 'destructive'} className="gap-1">
              {returnTrend === 'down' ? <TrendingDown className="h-3 w-3" /> : <TrendingUp className="h-3 w-3" />}
              {returnTrend === 'down' ? 'Good' : 'High'}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            {returnedOrders} of {orders.length} returned
          </p>
        </CardContent>
      </Card>

      {/* Daily Volume */}
      <Card className="border-primary/20">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Calendar className="h-4 w-4 text-primary" />
            Daily Volume
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={60}>
            <LineChart data={dailyVolumeData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
              <XAxis dataKey="date" tick={{ fontSize: 10 }} />
              <Tooltip />
              <Line type="monotone" dataKey="count" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
          <p className="text-xs text-muted-foreground mt-1">Last 7 days trend</p>
        </CardContent>
      </Card>
    </div>
  );
};
