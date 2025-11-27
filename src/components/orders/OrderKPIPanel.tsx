import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, TrendingDown, Package, MapPin, Truck, RotateCcw, Calendar } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from "recharts";
import { startOfMonth, endOfMonth, subMonths } from "date-fns";
import { useState } from "react";

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
  const [monthFilter, setMonthFilter] = useState<'current' | 'last'>('current');
  
  if (!isVisible || !orders.length) return null;

  // Filter orders by selected month
  const now = new Date();
  const currentMonthStart = startOfMonth(now);
  const currentMonthEnd = endOfMonth(now);
  const lastMonthStart = startOfMonth(subMonths(now, 1));
  const lastMonthEnd = endOfMonth(subMonths(now, 1));

  const filteredOrders = orders.filter(order => {
    const orderDate = new Date(order.created_at);
    if (monthFilter === 'current') {
      return orderDate >= currentMonthStart && orderDate <= currentMonthEnd;
    } else {
      return orderDate >= lastMonthStart && orderDate <= lastMonthEnd;
    }
  });

  // Calculate AOV
  const totalRevenue = filteredOrders.reduce((sum, order) => sum + Number(order.total_amount || 0), 0);
  const aov = filteredOrders.length > 0 ? totalRevenue / filteredOrders.length : 0;

  // Orders by City (top 5)
  const cityData = filteredOrders.reduce((acc, order) => {
    const city = order.city || "Unknown";
    acc[city] = (acc[city] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  
  const topCities = Object.entries(cityData)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)
    .map(([city, count]) => ({ city, count }));

  // Orders by Courier with proper colors
  const courierData = filteredOrders.reduce((acc, order) => {
    const courier = order.courier || "Not Assigned";
    acc[courier] = (acc[courier] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  
  const getCourierChartColor = (courierName: string): string => {
    const courier = courierName.toLowerCase();
    if (courier.includes('postex')) return 'hsl(var(--courier-postex))';
    if (courier.includes('tcs')) return 'hsl(var(--courier-tcs))';
    if (courier.includes('leopard')) return 'hsl(var(--courier-leopard))';
    if (courier.includes('not assigned')) return 'hsl(var(--muted))';
    return 'hsl(var(--primary))';
  };
  
  const courierChartData = Object.entries(courierData).map(([name, value]) => ({
    name, 
    value,
    color: getCourierChartColor(name)
  }));

  // Return Rate
  const returnedOrders = filteredOrders.filter(o => o.status === 'returned').length;
  const returnRate = filteredOrders.length > 0 ? (returnedOrders / filteredOrders.length) * 100 : 0;
  const returnTrend = returnRate < 5 ? 'down' : 'up'; // Mock trend

  // Daily Volume (last 7 days)
  const last7Days = Array.from({ length: 7 }, (_, i) => {
    const date = new Date();
    date.setDate(date.getDate() - (6 - i));
    return date.toISOString().split('T')[0];
  });

  const dailyVolumeData = last7Days.map(date => {
    const count = filteredOrders.filter(o => o.created_at?.split('T')[0] === date).length;
    return { date: new Date(date).getDate().toString(), count };
  });

  return (
    <div className="space-y-4 mb-6 animate-fade-in">
      {/* Month Filter */}
      <div className="flex justify-end">
        <Tabs value={monthFilter} onValueChange={(v) => setMonthFilter(v as 'current' | 'last')}>
          <TabsList>
            <TabsTrigger value="current">Current Month</TabsTrigger>
            <TabsTrigger value="last">Last Month</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
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
            From {filteredOrders.length} orders
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
              <Tooltip 
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    return (
                      <div className="bg-popover border border-border rounded-md p-2 shadow-md">
                        <p className="text-xs font-medium">{payload[0].payload.city}</p>
                        <p className="text-xs text-muted-foreground">{payload[0].value} orders</p>
                      </div>
                    );
                  }
                  return null;
                }}
              />
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
        <CardContent>
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
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip 
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    return (
                      <div className="bg-popover border border-border rounded-md p-2 shadow-md">
                        <p className="text-xs font-medium">{payload[0].name}</p>
                        <p className="text-xs text-muted-foreground">{payload[0].value} orders</p>
                      </div>
                    );
                  }
                  return null;
                }}
              />
            </PieChart>
          </ResponsiveContainer>
          {/* Legend */}
          <div className="mt-3 space-y-1.5">
            {courierChartData.map((entry, index) => (
              <div key={`legend-${index}`} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-1.5">
                  <div 
                    className="w-2.5 h-2.5 rounded-full" 
                    style={{ backgroundColor: entry.color }}
                  />
                  <span className="font-medium">{entry.name}</span>
                </div>
                <span className="text-muted-foreground">{entry.value}</span>
              </div>
            ))}
          </div>
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
            {returnedOrders} of {filteredOrders.length} returned
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
    </div>
  );
};
