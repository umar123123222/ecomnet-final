import { Card, CardContent } from "@/components/ui/card";
import { TrendingUp, TrendingDown, Package, MapPin, Truck, RotateCcw, Calendar, ChevronDown, ChevronUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { BarChart, Bar, XAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from "recharts";
import { startOfMonth, endOfMonth, subMonths } from "date-fns";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

interface Order {
  id: string;
  total_amount: number;
  city: string;
  courier: string | null;
  status: string;
  created_at: string;
}

interface OrderKPIPanelProps {
  isVisible: boolean;
}

export const OrderKPIPanel = ({ isVisible }: OrderKPIPanelProps) => {
  const [monthFilter, setMonthFilter] = useState<'current' | 'last'>('current');
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [isExpanded, setIsExpanded] = useState(true);

  useEffect(() => {
    const fetchOrders = async () => {
      setLoading(true);
      try {
        const now = new Date();
        const monthStart = monthFilter === 'current' ? startOfMonth(now) : startOfMonth(subMonths(now, 1));
        const monthEnd = monthFilter === 'current' ? endOfMonth(now) : endOfMonth(subMonths(now, 1));
        
        const CHUNK_SIZE = 1000;
        let allOrders: Order[] = [];
        let offset = 0;
        let hasMore = true;
        
        while (hasMore) {
          const { data, error } = await supabase
            .from('orders')
            .select('id, total_amount, city, courier, status, created_at')
            .gte('created_at', monthStart.toISOString())
            .lte('created_at', monthEnd.toISOString())
            .range(offset, offset + CHUNK_SIZE - 1);
          
          if (error) throw error;
          
          if (data && data.length > 0) {
            allOrders = [...allOrders, ...data];
            offset += CHUNK_SIZE;
            hasMore = data.length === CHUNK_SIZE;
          } else {
            hasMore = false;
          }
        }
        
        setOrders(allOrders);
      } catch (error) {
        console.error('Error fetching KPI orders:', error);
        setOrders([]);
      } finally {
        setLoading(false);
      }
    };
    if (isVisible) {
      fetchOrders();
    }
  }, [monthFilter, isVisible]);

  if (!isVisible) return null;

  if (loading) {
    return (
      <div className="flex gap-3">
        {[...Array(5)].map((_, i) => (
          <Skeleton key={i} className="h-24 flex-1" />
        ))}
      </div>
    );
  }

  const filteredOrders = orders;

  // Calculate AOV
  const totalRevenue = filteredOrders.reduce((sum, order) => sum + Number(order.total_amount || 0), 0);
  const aov = filteredOrders.length > 0 ? totalRevenue / filteredOrders.length : 0;

  // Top Cities
  const cityData = filteredOrders.reduce((acc, order) => {
    const city = order.city || "Unknown";
    acc[city] = (acc[city] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  const topCities = Object.entries(cityData).sort(([, a], [, b]) => b - a).slice(0, 4).map(([city, count]) => ({
    city: city.slice(0, 8),
    count
  }));

  // Courier distribution
  const courierData = filteredOrders.reduce((acc, order) => {
    const courier = order.courier || "None";
    acc[courier] = (acc[courier] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  
  const getCourierChartColor = (courierName: string): string => {
    const courier = courierName.toLowerCase();
    if (courier.includes('postex')) return 'hsl(var(--courier-postex))';
    if (courier.includes('tcs')) return 'hsl(var(--courier-tcs))';
    if (courier.includes('leopard')) return 'hsl(var(--courier-leopard))';
    if (courier === 'none') return 'hsl(var(--muted))';
    return 'hsl(var(--primary))';
  };
  
  const courierChartData = Object.entries(courierData).map(([name, value]) => ({
    name: name.slice(0, 6),
    value,
    color: getCourierChartColor(name)
  }));

  // Return Rate
  const returnedOrders = filteredOrders.filter(o => o.status === 'returned').length;
  const returnRate = filteredOrders.length > 0 ? returnedOrders / filteredOrders.length * 100 : 0;
  const isGoodRate = returnRate < 5;

  // Daily Volume
  const now = new Date();
  const referenceDate = monthFilter === 'current' ? now : subMonths(now, 1);
  const monthEnd = endOfMonth(referenceDate);
  
  const last7DaysOfMonth = Array.from({ length: 7 }, (_, i) => {
    const date = new Date(monthEnd);
    date.setDate(date.getDate() - (6 - i));
    return date.toISOString().split('T')[0];
  });
  
  const dailyVolumeData = last7DaysOfMonth.map(date => {
    const count = filteredOrders.filter(o => o.created_at?.split('T')[0] === date).length;
    return { date: new Date(date).getDate().toString(), count };
  });

  return (
    <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="sm" className="h-7 px-2 gap-1">
              {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              <span className="text-xs font-medium">Analytics</span>
            </Button>
          </CollapsibleTrigger>
          <div className="flex gap-1">
            <Button
              variant={monthFilter === 'current' ? 'secondary' : 'ghost'}
              size="sm"
              className="h-6 px-2 text-xs"
              onClick={() => setMonthFilter('current')}
            >
              This Month
            </Button>
            <Button
              variant={monthFilter === 'last' ? 'secondary' : 'ghost'}
              size="sm"
              className="h-6 px-2 text-xs"
              onClick={() => setMonthFilter('last')}
            >
              Last Month
            </Button>
          </div>
        </div>
      </div>

      <CollapsibleContent>
        <div className="grid grid-cols-5 gap-3">
          {/* AOV */}
          <Card className="border-border/50">
            <CardContent className="p-3">
              <div className="flex items-center gap-1.5 mb-1">
                <Package className="h-3.5 w-3.5 text-primary" />
                <span className="text-xs text-muted-foreground">Avg Order</span>
              </div>
              <div className="text-lg font-bold">Rs {Math.round(aov).toLocaleString()}</div>
              <div className="text-[10px] text-muted-foreground">{filteredOrders.length} orders</div>
            </CardContent>
          </Card>

          {/* Top Cities */}
          <Card className="border-border/50">
            <CardContent className="p-3">
              <div className="flex items-center gap-1.5 mb-1">
                <MapPin className="h-3.5 w-3.5 text-primary" />
                <span className="text-xs text-muted-foreground">Top Cities</span>
              </div>
              <ResponsiveContainer width="100%" height={50}>
                <BarChart data={topCities} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                  <XAxis dataKey="city" tick={{ fontSize: 8 }} axisLine={false} tickLine={false} />
                  <Tooltip content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      return (
                        <div className="bg-popover border rounded px-2 py-1 text-xs shadow-md">
                          {payload[0].payload.city}: {payload[0].value}
                        </div>
                      );
                    }
                    return null;
                  }} />
                  <Bar dataKey="count" fill="hsl(var(--primary))" radius={[2, 2, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Courier Distribution */}
          <Card className="border-border/50">
            <CardContent className="p-3">
              <div className="flex items-center gap-1.5 mb-1">
                <Truck className="h-3.5 w-3.5 text-primary" />
                <span className="text-xs text-muted-foreground">Couriers</span>
              </div>
              <ResponsiveContainer width="100%" height={50}>
                <PieChart>
                  <Pie data={courierChartData} cx="50%" cy="50%" innerRadius={12} outerRadius={22} dataKey="value">
                    {courierChartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      return (
                        <div className="bg-popover border rounded px-2 py-1 text-xs shadow-md">
                          {payload[0].name}: {payload[0].value}
                        </div>
                      );
                    }
                    return null;
                  }} />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Return Rate */}
          <Card className="border-border/50">
            <CardContent className="p-3">
              <div className="flex items-center gap-1.5 mb-1">
                <RotateCcw className="h-3.5 w-3.5 text-primary" />
                <span className="text-xs text-muted-foreground">Returns</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-lg font-bold">{returnRate.toFixed(1)}%</span>
                <Badge variant={isGoodRate ? 'success' : 'destructive'} className="h-5 text-[10px] gap-0.5">
                  {isGoodRate ? <TrendingDown className="h-2.5 w-2.5" /> : <TrendingUp className="h-2.5 w-2.5" />}
                  {isGoodRate ? 'Good' : 'High'}
                </Badge>
              </div>
              <div className="text-[10px] text-muted-foreground">{returnedOrders}/{filteredOrders.length}</div>
            </CardContent>
          </Card>

          {/* Daily Volume */}
          <Card className="border-border/50">
            <CardContent className="p-3">
              <div className="flex items-center gap-1.5 mb-1">
                <Calendar className="h-3.5 w-3.5 text-primary" />
                <span className="text-xs text-muted-foreground">7-Day Trend</span>
              </div>
              <ResponsiveContainer width="100%" height={50}>
                <LineChart data={dailyVolumeData} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
                  <XAxis dataKey="date" tick={{ fontSize: 8 }} axisLine={false} tickLine={false} />
                  <Tooltip content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      return (
                        <div className="bg-popover border rounded px-2 py-1 text-xs shadow-md">
                          Day {payload[0].payload.date}: {payload[0].value}
                        </div>
                      );
                    }
                    return null;
                  }} />
                  <Line type="monotone" dataKey="count" stroke="hsl(var(--primary))" strokeWidth={1.5} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
};