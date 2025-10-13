import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { TrendingUp, TrendingDown, Clock, CheckCircle2, XCircle, AlertTriangle, Star, Package } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell, Legend } from 'recharts';

interface SupplierPerformance {
  id: string;
  supplier_id: string;
  total_orders: number;
  orders_on_time: number;
  orders_with_discrepancies: number;
  total_items_ordered: number;
  total_items_received: number;
  on_time_delivery_rate: number;
  accuracy_rate: number;
  quality_rejection_rate: number;
  average_lead_time_days: number;
  suppliers: {
    name: string;
    rating: number;
    status: string;
  };
}

const SupplierAnalyticsDashboard = () => {
  const [timeRange, setTimeRange] = useState('30');

  // Fetch supplier performance
  const { data: performance = [], isLoading } = useQuery({
    queryKey: ['supplier-performance', timeRange],
    queryFn: async () => {
      const daysAgo = new Date();
      daysAgo.setDate(daysAgo.getDate() - parseInt(timeRange));

      const { data, error } = await supabase
        .from('supplier_performance')
        .select(`
          *,
          suppliers(name, rating, status)
        `)
        .gte('date', daysAgo.toISOString().split('T')[0])
        .order('on_time_delivery_rate', { ascending: false });

      if (error) throw error;
      return data as SupplierPerformance[];
    }
  });

  // Aggregate performance by supplier
  const supplierStats = performance.reduce((acc, perf) => {
    const supplierId = perf.supplier_id;
    if (!acc[supplierId]) {
      acc[supplierId] = {
        name: perf.suppliers.name,
        rating: perf.suppliers.rating,
        status: perf.suppliers.status,
        totalOrders: 0,
        onTimeOrders: 0,
        totalDiscrepancies: 0,
        totalItemsOrdered: 0,
        totalItemsReceived: 0,
        avgLeadTime: 0,
        qualityRejectionRate: 0,
        count: 0
      };
    }
    acc[supplierId].totalOrders += perf.total_orders || 0;
    acc[supplierId].onTimeOrders += perf.orders_on_time || 0;
    acc[supplierId].totalDiscrepancies += perf.orders_with_discrepancies || 0;
    acc[supplierId].totalItemsOrdered += perf.total_items_ordered || 0;
    acc[supplierId].totalItemsReceived += perf.total_items_received || 0;
    acc[supplierId].avgLeadTime += perf.average_lead_time_days || 0;
    acc[supplierId].qualityRejectionRate += perf.quality_rejection_rate || 0;
    acc[supplierId].count += 1;
    return acc;
  }, {} as Record<string, any>);

  // Calculate final metrics
  const suppliers = Object.entries(supplierStats).map(([id, stats]) => ({
    id,
    name: stats.name,
    rating: stats.rating,
    status: stats.status,
    onTimeRate: stats.totalOrders > 0 ? (stats.onTimeOrders / stats.totalOrders) * 100 : 0,
    accuracyRate: stats.totalItemsOrdered > 0 ? ((stats.totalItemsOrdered - (stats.totalItemsOrdered - stats.totalItemsReceived)) / stats.totalItemsOrdered) * 100 : 100,
    discrepancyRate: stats.totalOrders > 0 ? (stats.totalDiscrepancies / stats.totalOrders) * 100 : 0,
    avgLeadTime: stats.count > 0 ? Math.round(stats.avgLeadTime / stats.count) : 0,
    qualityRejectionRate: stats.count > 0 ? stats.qualityRejectionRate / stats.count : 0,
    totalOrders: stats.totalOrders
  }));

  // Overall stats
  const overallStats = {
    totalSuppliers: suppliers.length,
    avgOnTimeRate: suppliers.length > 0 ? suppliers.reduce((sum, s) => sum + s.onTimeRate, 0) / suppliers.length : 0,
    avgAccuracyRate: suppliers.length > 0 ? suppliers.reduce((sum, s) => sum + s.accuracyRate, 0) / suppliers.length : 0,
    avgLeadTime: suppliers.length > 0 ? suppliers.reduce((sum, s) => sum + s.avgLeadTime, 0) / suppliers.length : 0,
    topPerformers: suppliers.filter(s => s.onTimeRate >= 95 && s.accuracyRate >= 98).length,
    poorPerformers: suppliers.filter(s => s.onTimeRate < 80 || s.accuracyRate < 90).length
  };

  // Chart data
  const chartData = suppliers.map(s => ({
    name: s.name.length > 15 ? s.name.substring(0, 15) + '...' : s.name,
    onTimeRate: s.onTimeRate,
    accuracyRate: s.accuracyRate
  }));

  const leadTimeData = suppliers.map(s => ({
    name: s.name.length > 15 ? s.name.substring(0, 15) + '...' : s.name,
    leadTime: s.avgLeadTime
  }));

  const COLORS = ['#10b981', '#f59e0b', '#ef4444'];

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <TrendingUp className="h-8 w-8 text-primary" />
            Supplier Performance Analytics
          </h1>
          <p className="text-muted-foreground">Track and analyze supplier reliability and quality</p>
        </div>
        <Tabs value={timeRange} onValueChange={setTimeRange}>
          <TabsList>
            <TabsTrigger value="7">7 Days</TabsTrigger>
            <TabsTrigger value="30">30 Days</TabsTrigger>
            <TabsTrigger value="90">90 Days</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Overall Stats */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Suppliers</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{overallStats.totalSuppliers}</div>
          </CardContent>
        </Card>
        <Card className="border-green-200 dark:border-green-900">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              Top Performers
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{overallStats.topPerformers}</div>
            <p className="text-xs text-muted-foreground mt-1">≥95% on-time & ≥98% accuracy</p>
          </CardContent>
        </Card>
        <Card className="border-red-200 dark:border-red-900">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <XCircle className="h-4 w-4 text-red-600" />
              Poor Performers
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{overallStats.poorPerformers}</div>
            <p className="text-xs text-muted-foreground mt-1">&lt;80% on-time or &lt;90% accuracy</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Avg On-Time Rate</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{overallStats.avgOnTimeRate.toFixed(1)}%</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Avg Lead Time</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{overallStats.avgLeadTime.toFixed(0)} days</div>
          </CardContent>
        </Card>
      </div>

      {/* Performance Charts */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>On-Time Delivery & Accuracy Rate</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" angle={-45} textAnchor="end" height={100} />
                <YAxis domain={[0, 100]} />
                <Tooltip />
                <Legend />
                <Bar dataKey="onTimeRate" fill="#10b981" name="On-Time %" />
                <Bar dataKey="accuracyRate" fill="#3b82f6" name="Accuracy %" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Average Lead Time (Days)</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={leadTimeData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" angle={-45} textAnchor="end" height={100} />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="leadTime" stroke="#f59e0b" strokeWidth={2} name="Lead Time" />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Supplier Details Table */}
      <Card>
        <CardHeader>
          <CardTitle>Supplier Performance Details</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8">Loading supplier performance data...</div>
          ) : suppliers.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Package className="mx-auto h-12 w-12 mb-4 opacity-50" />
              <p>No supplier performance data available</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-3 font-medium">Supplier</th>
                    <th className="text-left p-3 font-medium">Rating</th>
                    <th className="text-center p-3 font-medium">Orders</th>
                    <th className="text-center p-3 font-medium">On-Time %</th>
                    <th className="text-center p-3 font-medium">Accuracy %</th>
                    <th className="text-center p-3 font-medium">Discrepancy %</th>
                    <th className="text-center p-3 font-medium">Avg Lead Time</th>
                    <th className="text-center p-3 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {suppliers.map((supplier) => (
                    <tr key={supplier.id} className="border-b hover:bg-muted/50">
                      <td className="p-3 font-medium">{supplier.name}</td>
                      <td className="p-3">
                        <div className="flex items-center gap-1">
                          {[...Array(5)].map((_, i) => (
                            <Star
                              key={i}
                              className={`h-3 w-3 ${i < supplier.rating ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'}`}
                            />
                          ))}
                        </div>
                      </td>
                      <td className="p-3 text-center">{supplier.totalOrders}</td>
                      <td className="p-3 text-center">
                        <Badge variant={supplier.onTimeRate >= 95 ? 'default' : supplier.onTimeRate >= 80 ? 'secondary' : 'destructive'}>
                          {supplier.onTimeRate.toFixed(1)}%
                        </Badge>
                      </td>
                      <td className="p-3 text-center">
                        <Badge variant={supplier.accuracyRate >= 98 ? 'default' : supplier.accuracyRate >= 90 ? 'secondary' : 'destructive'}>
                          {supplier.accuracyRate.toFixed(1)}%
                        </Badge>
                      </td>
                      <td className="p-3 text-center">
                        <Badge variant={supplier.discrepancyRate <= 5 ? 'default' : supplier.discrepancyRate <= 15 ? 'secondary' : 'destructive'}>
                          {supplier.discrepancyRate.toFixed(1)}%
                        </Badge>
                      </td>
                      <td className="p-3 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <Clock className="h-3 w-3 text-muted-foreground" />
                          {supplier.avgLeadTime} days
                        </div>
                      </td>
                      <td className="p-3 text-center">
                        <Badge variant={supplier.status === 'active' ? 'default' : 'secondary'}>
                          {supplier.status}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default SupplierAnalyticsDashboard;
