import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { PageContainer, PageHeader } from '@/components/layout';
import { DatePickerWithRange } from '@/components/DatePickerWithRange';
import { useCurrency } from '@/hooks/useCurrency';
import { 
  TrendingUp, TrendingDown, DollarSign, Package, Truck, 
  AlertTriangle, CheckCircle, ArrowUpRight, ArrowDownRight,
  Download, BarChart3, PieChart, Activity, XCircle, RotateCcw, 
  ShoppingCart, Info
} from 'lucide-react';
import { format, subDays, startOfMonth, endOfMonth, subMonths } from 'date-fns';
import { DateRange } from 'react-day-picker';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer,
  LineChart, Line, PieChart as RechartPieChart, Pie, Cell
} from 'recharts';

// Courier-specific chart colors - matching the theme
const getCourierChartColor = (courierCode: string): string => {
  const code = courierCode.toLowerCase();
  if (code.includes('postex')) return 'hsl(var(--courier-postex))';
  if (code.includes('tcs')) return 'hsl(var(--courier-tcs))';
  if (code.includes('leopard')) return 'hsl(var(--courier-leopard))';
  // Fallback colors for other couriers
  return 'hsl(var(--primary))';
};

const FinanceAnalyticsDashboard = () => {
  const { currency } = useCurrency();
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: startOfMonth(new Date()),
    to: endOfMonth(new Date())
  });
  const [selectedCourier, setSelectedCourier] = useState<string>('all');

  // Fetch couriers
  const { data: couriers = [] } = useQuery({
    queryKey: ['couriers-active'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('couriers')
        .select('id, name, code')
        .eq('is_active', true)
        .order('name');
      if (error) throw error;
      return data;
    }
  });

  // Fetch ALL orders for total orders placed (no limit)
  const { data: allOrders = [], isLoading: loadingAllOrders } = useQuery({
    queryKey: ['finance-all-orders', dateRange, selectedCourier],
    queryFn: async () => {
      const fromDate = dateRange?.from?.toISOString() || startOfMonth(new Date()).toISOString();
      const toDate = dateRange?.to?.toISOString() || endOfMonth(new Date()).toISOString();
      
      // Fetch in batches to overcome 1000 row limit
      let allData: any[] = [];
      let offset = 0;
      const batchSize = 1000;
      
      while (true) {
        const { data, error } = await supabase
          .from('orders')
          .select('id, order_number, total_amount, shipping_charges, courier, status, created_at, dispatched_at, delivered_at')
          .gte('created_at', fromDate)
          .lte('created_at', toDate)
          .range(offset, offset + batchSize - 1);

        if (error) throw error;
        if (!data || data.length === 0) break;
        
        allData = [...allData, ...data];
        if (data.length < batchSize) break;
        offset += batchSize;
      }
      
      if (selectedCourier !== 'all') {
        return allData.filter(o => o.courier === selectedCourier);
      }
      return allData;
    }
  });

  // Fetch delivered orders with COD data (no limit)
  const { data: deliveredOrders = [], isLoading: loadingOrders } = useQuery({
    queryKey: ['finance-delivered-orders', dateRange, selectedCourier],
    queryFn: async () => {
      const fromDate = dateRange?.from?.toISOString() || startOfMonth(new Date()).toISOString();
      const toDate = dateRange?.to?.toISOString() || endOfMonth(new Date()).toISOString();
      
      let allData: any[] = [];
      let offset = 0;
      const batchSize = 1000;
      
      while (true) {
        const { data, error } = await supabase
          .from('orders')
          .select('id, order_number, total_amount, shipping_charges, courier, status, delivered_at, created_at')
          .in('status', ['delivered', 'returned'])
          .gte('created_at', fromDate)
          .lte('created_at', toDate)
          .range(offset, offset + batchSize - 1);

        if (error) throw error;
        if (!data || data.length === 0) break;
        
        allData = [...allData, ...data];
        if (data.length < batchSize) break;
        offset += batchSize;
      }
      
      if (selectedCourier !== 'all') {
        return allData.filter(o => o.courier === selectedCourier);
      }
      return allData;
    }
  });

  // Fetch dispatched orders for total parcels (no limit)
  const { data: dispatchedOrders = [] } = useQuery({
    queryKey: ['finance-dispatched-orders', dateRange, selectedCourier],
    queryFn: async () => {
      const fromDate = dateRange?.from?.toISOString() || startOfMonth(new Date()).toISOString();
      const toDate = dateRange?.to?.toISOString() || endOfMonth(new Date()).toISOString();
      
      let allData: any[] = [];
      let offset = 0;
      const batchSize = 1000;
      
      while (true) {
        const { data, error } = await supabase
          .from('orders')
          .select('id, order_number, total_amount, courier, status, dispatched_at')
          .in('status', ['dispatched', 'delivered', 'returned'])
          .gte('dispatched_at', fromDate)
          .lte('dispatched_at', toDate)
          .range(offset, offset + batchSize - 1);

        if (error) throw error;
        if (!data || data.length === 0) break;
        
        allData = [...allData, ...data];
        if (data.length < batchSize) break;
        offset += batchSize;
      }
      
      if (selectedCourier !== 'all') {
        return allData.filter(o => o.courier === selectedCourier);
      }
      return allData;
    }
  });

  // Fetch returns received at warehouse (filter by received_at date)
  const { data: returns = [] } = useQuery({
    queryKey: ['finance-returns', dateRange, selectedCourier],
    queryFn: async () => {
      const fromDate = dateRange?.from?.toISOString() || startOfMonth(new Date()).toISOString();
      const toDate = dateRange?.to?.toISOString() || endOfMonth(new Date()).toISOString();
      
      let allData: any[] = [];
      let offset = 0;
      const batchSize = 1000;
      
      while (true) {
        const { data, error } = await supabase
          .from('returns')
          .select(`
            id, order_id, return_status, claim_amount, claimed_at, received_at,
            orders!inner(total_amount, courier, order_number)
          `)
          .not('received_at', 'is', null)
          .gte('received_at', fromDate)
          .lte('received_at', toDate)
          .range(offset, offset + batchSize - 1);

        if (error) throw error;
        if (!data || data.length === 0) break;
        
        allData = [...allData, ...data];
        if (data.length < batchSize) break;
        offset += batchSize;
      }
      
      if (selectedCourier !== 'all') {
        return allData.filter((r: any) => r.orders?.courier === selectedCourier);
      }
      return allData;
    }
  });

  // Fetch cancelled orders with their item values (filter by updated_at when cancelled)
  const { data: cancelledOrderValues = [] } = useQuery({
    queryKey: ['finance-cancelled-order-values', dateRange, selectedCourier],
    queryFn: async () => {
      const fromDate = dateRange?.from?.toISOString() || startOfMonth(new Date()).toISOString();
      const toDate = dateRange?.to?.toISOString() || endOfMonth(new Date()).toISOString();
      
      const { data, error } = await supabase
        .from('orders')
        .select('id, courier, updated_at, order_items(price, quantity)')
        .eq('status', 'cancelled')
        .gte('updated_at', fromDate)
        .lte('updated_at', toDate);

      if (error) throw error;
      
      // Calculate value from order_items for each cancelled order
      const result = (data || []).map((order: any) => ({
        id: order.id,
        courier: order.courier,
        value: order.order_items?.reduce((sum: number, item: any) => 
          sum + (Number(item.price) * Number(item.quantity)), 0) || 0
      }));
      
      if (selectedCourier !== 'all') {
        return result.filter(o => o.courier === selectedCourier);
      }
      return result;
    }
  });

  // Fetch returns in route - courier marked as returned but order still dispatched (not received at warehouse)
  // This matches /returns-not-received page logic using courier_tracking_history
  const { data: returnsInRoute = [] } = useQuery({
    queryKey: ['finance-returns-in-route', dateRange, selectedCourier],
    queryFn: async () => {
      const fromDate = dateRange?.from?.toISOString() || startOfMonth(new Date()).toISOString();
      const toDate = dateRange?.to?.toISOString() || endOfMonth(new Date()).toISOString();
      
      // Query courier_tracking_history for 'returned' status where order is still 'dispatched'
      let allData: any[] = [];
      let offset = 0;
      const batchSize = 1000;
      
      while (true) {
        const { data, error } = await supabase
          .from('courier_tracking_history')
          .select(`
            order_id,
            tracking_id,
            checked_at,
            dispatches!courier_tracking_history_dispatch_id_fkey (
              courier,
              orders!inner (
                id,
                total_amount,
                status
              )
            )
          `)
          .eq('status', 'returned')
          .eq('dispatches.orders.status', 'dispatched')
          .gte('checked_at', fromDate)
          .lte('checked_at', toDate)
          .range(offset, offset + batchSize - 1);

        if (error) throw error;
        if (!data || data.length === 0) break;
        
        allData = [...allData, ...data];
        if (data.length < batchSize) break;
        offset += batchSize;
      }
      
      // Deduplicate by order_id (keep latest)
      const latestByOrder = new Map();
      allData.forEach((tracking: any) => {
        const order = tracking.dispatches?.orders;
        if (!order || !order.id) return;
        if (!latestByOrder.has(order.id)) {
          latestByOrder.set(order.id, {
            id: order.id,
            total_amount: order.total_amount,
            courier: tracking.dispatches?.courier
          });
        }
      });
      
      const result = Array.from(latestByOrder.values());
      
      if (selectedCourier !== 'all') {
        return result.filter(o => o.courier === selectedCourier);
      }
      return result;
    }
  });

  // Calculate courier-wise analytics
  const courierAnalytics = useMemo(() => {
    const analytics: Record<string, {
      name: string;
      code: string;
      totalOrders: number;
      deliveredOrders: number;
      returnedOrders: number;
      totalCOD: number;
      deliveryCharges: number;
      returnCharges: number;
      claimAmount: number;
      netRevenue: number;
      rtoPercentage: number;
    }> = {};

    // Initialize with all couriers
    couriers.forEach(c => {
      analytics[c.code] = {
        name: c.name,
        code: c.code,
        totalOrders: 0,
        deliveredOrders: 0,
        returnedOrders: 0,
        totalCOD: 0,
        deliveryCharges: 0,
        returnCharges: 0,
        claimAmount: 0,
        netRevenue: 0,
        rtoPercentage: 0
      };
    });

    // Process dispatched orders
    dispatchedOrders.forEach(order => {
      const courierCode = order.courier || 'other';
      if (!analytics[courierCode]) {
        analytics[courierCode] = {
          name: courierCode,
          code: courierCode,
          totalOrders: 0,
          deliveredOrders: 0,
          returnedOrders: 0,
          totalCOD: 0,
          deliveryCharges: 0,
          returnCharges: 0,
          claimAmount: 0,
          netRevenue: 0,
          rtoPercentage: 0
        };
      }
      analytics[courierCode].totalOrders++;
    });

    // Process delivered orders
    deliveredOrders.forEach(order => {
      const courierCode = order.courier || 'other';
      if (!analytics[courierCode]) return;
      
      if (order.status === 'delivered') {
        analytics[courierCode].deliveredOrders++;
        analytics[courierCode].totalCOD += Number(order.total_amount) || 0;
        analytics[courierCode].deliveryCharges += Number(order.shipping_charges) || 0;
      } else if (order.status === 'returned') {
        analytics[courierCode].returnedOrders++;
        analytics[courierCode].returnCharges += Number(order.shipping_charges) || 0;
      }
    });

    // Process claims
    returns.forEach((ret: any) => {
      const courierCode = ret.orders?.courier || 'other';
      if (!analytics[courierCode]) return;
      if (ret.claim_amount) {
        analytics[courierCode].claimAmount += Number(ret.claim_amount) || 0;
      }
    });

    // Calculate net revenue and RTO percentage
    Object.keys(analytics).forEach(code => {
      const a = analytics[code];
      a.netRevenue = a.totalCOD - a.deliveryCharges - a.returnCharges - a.claimAmount;
      a.rtoPercentage = a.totalOrders > 0 ? (a.returnedOrders / a.totalOrders) * 100 : 0;
    });

    return Object.values(analytics).filter(a => a.totalOrders > 0);
  }, [couriers, deliveredOrders, dispatchedOrders, returns]);

  // Calculate overall KPIs
  const kpis = useMemo(() => {
    const totalCOD = courierAnalytics.reduce((sum, c) => sum + c.totalCOD, 0);
    const totalCharges = courierAnalytics.reduce((sum, c) => sum + c.deliveryCharges + c.returnCharges, 0);
    const totalClaims = courierAnalytics.reduce((sum, c) => sum + c.claimAmount, 0);
    const totalLosses = totalCharges + totalClaims;
    const netRevenue = totalCOD - totalLosses;
    const profitMargin = totalCOD > 0 ? (netRevenue / totalCOD) * 100 : 0;
    const totalParcels = courierAnalytics.reduce((sum, c) => sum + c.deliveredOrders, 0);

    // Orders Placed - filtered by created_at
    const totalOrdersPlaced = allOrders.length;
    const totalOrdersPlacedValue = allOrders.reduce((sum, o) => sum + (Number(o.total_amount) || 0), 0);
    
    // Cancelled orders - filtered by updated_at (when status changed to cancelled)
    // Value calculated from order_items (since total_amount is 0 for cancelled)
    const totalOrdersCancelled = cancelledOrderValues.length;
    const cancelledValue = cancelledOrderValues.reduce((sum, o) => sum + (Number(o.value) || 0), 0);
    
    // Dispatched orders - filtered by dispatched_at
    const totalOrdersDispatched = dispatchedOrders.length;
    const dispatchedValue = dispatchedOrders.reduce((sum, o) => sum + (Number(o.total_amount) || 0), 0);
    
    // Returns Received - uses returns table filtered by received_at
    const totalReturnsReceived = returns.length;
    const returnsReceivedValue = returns.reduce((sum: number, r: any) => sum + (Number(r.orders?.total_amount) || 0), 0);
    
    // Returns in route - courier tracking shows 'returned' but order still 'dispatched' (filtered by checked_at)
    const returnsInRouteCount = returnsInRoute.length;
    const returnsInRouteValue = returnsInRoute.reduce((sum, o) => sum + (Number(o.total_amount) || 0), 0);

    return {
      totalRevenue: netRevenue,
      totalCOD,
      totalCharges: totalLosses,
      netProfit: netRevenue,
      profitMargin,
      totalParcels,
      // New KPIs
      totalOrdersPlaced,
      totalOrdersPlacedValue,
      totalOrdersCancelled,
      cancelledValue,
      totalOrdersDispatched,
      dispatchedValue,
      totalReturnsReceived,
      returnsReceivedValue,
      returnsInRoute: returnsInRouteCount,
      returnsInRouteValue
    };
  }, [courierAnalytics, allOrders, cancelledOrderValues, dispatchedOrders, returns, returnsInRoute]);

  // Smart alerts/insights
  const insights = useMemo(() => {
    const alerts: Array<{ type: 'warning' | 'success' | 'info'; message: string; Icon: typeof AlertTriangle }> = [];

    if (courierAnalytics.length === 0) return alerts;

    // Highest RTO courier
    const highestRTO = courierAnalytics.reduce((max, c) => 
      c.rtoPercentage > max.rtoPercentage ? c : max, courierAnalytics[0]);
    if (highestRTO.rtoPercentage > 10) {
      alerts.push({
        type: 'warning',
        message: `${highestRTO.name} has highest RTO at ${highestRTO.rtoPercentage.toFixed(1)}%`,
        Icon: AlertTriangle
      });
    }

    // Best performing courier (lowest RTO with decent volume)
    const bestPerformer = courierAnalytics
      .filter(c => c.totalOrders >= 10)
      .reduce((min, c) => c.rtoPercentage < min.rtoPercentage ? c : min, courierAnalytics[0]);
    if (bestPerformer && bestPerformer.totalOrders >= 10) {
      alerts.push({
        type: 'success',
        message: `${bestPerformer.name} performing best with ${bestPerformer.rtoPercentage.toFixed(1)}% RTO`,
        Icon: CheckCircle
      });
    }

    // High revenue courier
    const topRevenue = courierAnalytics.reduce((max, c) => 
      c.netRevenue > max.netRevenue ? c : max, courierAnalytics[0]);
    if (topRevenue.netRevenue > 0) {
      alerts.push({
        type: 'info',
        message: `${topRevenue.name} generated highest revenue: ${currency} ${topRevenue.netRevenue.toLocaleString()}`,
        Icon: TrendingUp
      });
    }

    return alerts;
  }, [courierAnalytics, currency]);

  // Monthly chart data
  const monthlyChartData = useMemo(() => {
    const months: Record<string, { month: string; revenue: number; parcels: number; [key: string]: any }> = {};
    
    // Get last 6 months
    for (let i = 5; i >= 0; i--) {
      const date = subMonths(new Date(), i);
      const monthKey = format(date, 'MMM yyyy');
      months[monthKey] = { month: monthKey, revenue: 0, parcels: 0 };
      couriers.forEach(c => {
        months[monthKey][c.code] = 0;
      });
    }

    deliveredOrders.forEach(order => {
      if (order.status !== 'delivered' || !order.delivered_at) return;
      const monthKey = format(new Date(order.delivered_at), 'MMM yyyy');
      if (months[monthKey]) {
        months[monthKey].revenue += Number(order.total_amount) || 0;
        months[monthKey].parcels++;
        if (order.courier && months[monthKey][order.courier] !== undefined) {
          months[monthKey][order.courier] += Number(order.total_amount) || 0;
        }
      }
    });

    return Object.values(months);
  }, [deliveredOrders, couriers]);

  // Export to CSV
  const exportToCSV = () => {
    const headers = ['Courier', 'Total Orders', 'Delivered', 'Returned', 'RTO %', 'Total COD', 'Charges', 'Claims', 'Net Revenue'];
    const rows = courierAnalytics.map(c => [
      c.name,
      c.totalOrders,
      c.deliveredOrders,
      c.returnedOrders,
      c.rtoPercentage.toFixed(1),
      c.totalCOD,
      c.deliveryCharges + c.returnCharges,
      c.claimAmount,
      c.netRevenue
    ]);

    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `courier-analytics-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
  };

  return (
    <PageContainer>
      <PageHeader
        title="Finance Analytics"
        description="Revenue, profit, and courier performance insights"
        actions={
          <Button onClick={exportToCSV} variant="outline">
            <Download className="mr-2 h-4 w-4" />
            Export CSV
          </Button>
        }
      />

      {/* Filters */}
      <Card className="mb-6">
        <CardContent className="pt-6">
          <div className="flex flex-wrap gap-4 items-center">
            <div className="flex-1 min-w-[200px]">
              <DatePickerWithRange date={dateRange} setDate={setDateRange} />
            </div>
            <Select value={selectedCourier} onValueChange={setSelectedCourier}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="All Couriers" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Couriers</SelectItem>
                {couriers.map(c => (
                  <SelectItem key={c.id} value={c.code}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Order Statistics Cards */}
      <TooltipProvider>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-6">
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    Orders Placed
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Info className="h-3 w-3 cursor-pointer text-muted-foreground/60 hover:text-muted-foreground" />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p className="max-w-[200px] text-xs">Orders placed (created_at) during the selected period, regardless of current status.</p>
                      </TooltipContent>
                    </Tooltip>
                  </p>
                  <p className="text-xl font-bold">{kpis.totalOrdersPlaced.toLocaleString()}</p>
                  <p className="text-xs text-muted-foreground">{currency} {kpis.totalOrdersPlacedValue.toLocaleString()}</p>
                </div>
                <ShoppingCart className="h-8 w-8 text-primary/20" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    Cancelled
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Info className="h-3 w-3 cursor-pointer text-muted-foreground/60 hover:text-muted-foreground" />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p className="max-w-[200px] text-xs">Orders cancelled (updated_at) during the selected period. Value from order items.</p>
                      </TooltipContent>
                    </Tooltip>
                  </p>
                  <p className="text-xl font-bold text-red-600">{kpis.totalOrdersCancelled.toLocaleString()}</p>
                  <p className="text-xs text-muted-foreground">{currency} {kpis.cancelledValue.toLocaleString()}</p>
                </div>
                <XCircle className="h-8 w-8 text-red-600/20" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    Dispatched
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Info className="h-3 w-3 cursor-pointer text-muted-foreground/60 hover:text-muted-foreground" />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p className="max-w-[200px] text-xs">Orders dispatched (dispatched_at) during the selected period, regardless of when placed.</p>
                      </TooltipContent>
                    </Tooltip>
                  </p>
                  <p className="text-xl font-bold text-blue-600">{kpis.totalOrdersDispatched.toLocaleString()}</p>
                  <p className="text-xs text-muted-foreground">{currency} {kpis.dispatchedValue.toLocaleString()}</p>
                </div>
                <Truck className="h-8 w-8 text-blue-600/20" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    Returns Received
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Info className="h-3 w-3 cursor-pointer text-muted-foreground/60 hover:text-muted-foreground" />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p className="max-w-[200px] text-xs">Returns received at warehouse (received_at) during the selected period.</p>
                      </TooltipContent>
                    </Tooltip>
                  </p>
                  <p className="text-xl font-bold text-orange-600">{kpis.totalReturnsReceived.toLocaleString()}</p>
                  <p className="text-xs text-muted-foreground">{currency} {kpis.returnsReceivedValue.toLocaleString()}</p>
                </div>
                <RotateCcw className="h-8 w-8 text-orange-600/20" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    Returns in Route
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Info className="h-3 w-3 cursor-pointer text-muted-foreground/60 hover:text-muted-foreground" />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p className="max-w-[200px] text-xs">Courier marked as returned (checked_at) during this period but not yet received at warehouse.</p>
                      </TooltipContent>
                    </Tooltip>
                  </p>
                  <p className="text-xl font-bold text-yellow-600">{kpis.returnsInRoute.toLocaleString()}</p>
                  <p className="text-xs text-muted-foreground">{currency} {kpis.returnsInRouteValue.toLocaleString()}</p>
                </div>
                <Truck className="h-8 w-8 text-yellow-600/20" />
              </div>
            </CardContent>
          </Card>
        </div>
      </TooltipProvider>

      {/* Financial KPI Cards */}
      <TooltipProvider>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    Net Revenue
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Info className="h-3 w-3 cursor-pointer text-muted-foreground/60 hover:text-muted-foreground" />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p className="max-w-[200px] text-xs">COD collected minus delivery charges, return charges, and claims.</p>
                      </TooltipContent>
                    </Tooltip>
                  </p>
                  <p className="text-xl font-bold text-green-600">{currency} {kpis.totalRevenue.toLocaleString()}</p>
                </div>
                <DollarSign className="h-8 w-8 text-green-600/20" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    COD Collected
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Info className="h-3 w-3 cursor-pointer text-muted-foreground/60 hover:text-muted-foreground" />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p className="max-w-[200px] text-xs">Total Cash on Delivery amount collected from successfully delivered orders.</p>
                      </TooltipContent>
                    </Tooltip>
                  </p>
                  <p className="text-xl font-bold">{currency} {kpis.totalCOD.toLocaleString()}</p>
                </div>
                <Activity className="h-8 w-8 text-primary/20" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    Total Deductions
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Info className="h-3 w-3 cursor-pointer text-muted-foreground/60 hover:text-muted-foreground" />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p className="max-w-[200px] text-xs">Sum of delivery charges + return handling charges + courier claims deductions.</p>
                      </TooltipContent>
                    </Tooltip>
                  </p>
                  <p className="text-xl font-bold text-red-600">{currency} {kpis.totalCharges.toLocaleString()}</p>
                </div>
                <TrendingDown className="h-8 w-8 text-red-600/20" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    Net Profit
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Info className="h-3 w-3 cursor-pointer text-muted-foreground/60 hover:text-muted-foreground" />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p className="max-w-[200px] text-xs">Final profit after all courier-related expenses are deducted from COD.</p>
                      </TooltipContent>
                    </Tooltip>
                  </p>
                  <p className="text-xl font-bold text-green-600">{currency} {kpis.netProfit.toLocaleString()}</p>
                </div>
                <TrendingUp className="h-8 w-8 text-green-600/20" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    Profit Margin
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Info className="h-3 w-3 cursor-pointer text-muted-foreground/60 hover:text-muted-foreground" />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p className="max-w-[200px] text-xs">Percentage of profit: (Net Revenue ÷ COD Collected) × 100</p>
                      </TooltipContent>
                    </Tooltip>
                  </p>
                  <p className="text-xl font-bold">{kpis.profitMargin.toFixed(1)}%</p>
                </div>
                <PieChart className="h-8 w-8 text-primary/20" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    Delivered
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Info className="h-3 w-3 cursor-pointer text-muted-foreground/60 hover:text-muted-foreground" />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p className="max-w-[200px] text-xs">Number of parcels successfully delivered to customers.</p>
                      </TooltipContent>
                    </Tooltip>
                  </p>
                  <p className="text-xl font-bold">{kpis.totalParcels.toLocaleString()}</p>
                </div>
                <Package className="h-8 w-8 text-primary/20" />
              </div>
            </CardContent>
          </Card>
        </div>
      </TooltipProvider>

      {/* Smart Alerts */}
      {insights.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          {insights.map((insight, idx) => (
            <Card key={idx} className={`border-l-4 ${
              insight.type === 'warning' ? 'border-l-yellow-500 bg-yellow-50/50 dark:bg-yellow-950/20' :
              insight.type === 'success' ? 'border-l-green-500 bg-green-50/50 dark:bg-green-950/20' :
              'border-l-blue-500 bg-blue-50/50 dark:bg-blue-950/20'
            }`}>
              <CardContent className="pt-4 flex items-center gap-3">
                <insight.Icon className={`h-5 w-5 ${
                  insight.type === 'warning' ? 'text-yellow-600' :
                  insight.type === 'success' ? 'text-green-600' : 'text-blue-600'
                }`} />
                <p className="text-sm font-medium">{insight.message}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Courier Analytics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
        {courierAnalytics.map(courier => (
          <Card key={courier.code}>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Truck className="h-5 w-5" />
                  {courier.name}
                </CardTitle>
                <Badge variant={courier.rtoPercentage > 15 ? 'destructive' : courier.rtoPercentage > 10 ? 'secondary' : 'default'}>
                  {courier.rtoPercentage.toFixed(1)}% RTO
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Total Orders</span>
                  <span className="font-medium">{courier.totalOrders}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Delivered</span>
                  <span className="font-medium text-green-600">{courier.deliveredOrders}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Returned</span>
                  <span className="font-medium text-red-600">{courier.returnedOrders}</span>
                </div>
                <div className="border-t pt-2 mt-2">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">COD Collected</span>
                    <span className="font-medium">{currency} {courier.totalCOD.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Deductions</span>
                    <span className="font-medium text-red-600">
                      {currency} {(courier.deliveryCharges + courier.returnCharges + courier.claimAmount).toLocaleString()}
                    </span>
                  </div>
                  <div className="flex justify-between font-semibold">
                    <span>Net Revenue</span>
                    <span className="text-green-600">{currency} {courier.netRevenue.toLocaleString()}</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Monthly Revenue Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Monthly Revenue Trend</CardTitle>
            <CardDescription>Revenue collected over the last 6 months</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={monthlyChartData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="month" className="text-xs" />
                  <YAxis className="text-xs" />
                  <RechartsTooltip 
                    formatter={(value: number) => [`${currency} ${value.toLocaleString()}`, 'Revenue']}
                    contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }}
                  />
                  <Line type="monotone" dataKey="revenue" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ fill: 'hsl(var(--primary))' }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Monthly Parcels Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Monthly Parcels Delivered</CardTitle>
            <CardDescription>Number of parcels delivered each month</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthlyChartData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="month" className="text-xs" />
                  <YAxis className="text-xs" />
                  <RechartsTooltip 
                    formatter={(value: number) => [value.toLocaleString(), 'Parcels']}
                    contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }}
                  />
                  <Bar dataKey="parcels" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Revenue by Courier */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Revenue by Courier (Monthly)</CardTitle>
            <CardDescription>Comparison of revenue across couriers</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthlyChartData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="month" className="text-xs" />
                  <YAxis className="text-xs" />
                  <RechartsTooltip 
                    formatter={(value: number) => [`${currency} ${value.toLocaleString()}`]}
                    contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }}
                  />
                  <Legend />
                  {couriers.slice(0, 5).map((c) => (
                    <Bar key={c.code} dataKey={c.code} name={c.name} fill={getCourierChartColor(c.code)} stackId="a" />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>
    </PageContainer>
  );
};

export default FinanceAnalyticsDashboard;
