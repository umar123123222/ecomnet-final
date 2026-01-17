import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { TrendingUp, Clock, CheckCircle2, XCircle, Star, Package, DollarSign, FileCheck } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, Legend } from 'recharts';
import { formatCurrency } from '@/utils/currency';
import { useCurrency } from '@/hooks/useCurrency';

interface SupplierMetrics {
  id: string;
  name: string;
  rating: number;
  status: string;
  lead_time_days: number;
  totalPOs: number;
  completedPOs: number;
  cancelledPOs: number;
  pendingPOs: number;
  totalGRNs: number;
  grnsWithDiscrepancies: number;
  totalSpent: number;
  totalItemsOrdered: number;
  totalItemsReceived: number;
}

const SupplierAnalyticsDashboard = () => {
  const [timeRange, setTimeRange] = useState('30');
  const { currency } = useCurrency();
  const formatPrice = (amount: number) => formatCurrency(amount, currency);

  // Fetch real supplier metrics from POs and GRNs
  const { data: supplierMetrics = [], isLoading } = useQuery({
    queryKey: ['supplier-analytics', timeRange],
    queryFn: async () => {
      const daysAgo = new Date();
      daysAgo.setDate(daysAgo.getDate() - parseInt(timeRange));
      const dateFilter = daysAgo.toISOString();

      // Fetch suppliers
      const { data: suppliers, error: suppError } = await supabase
        .from('suppliers')
        .select('id, name, rating, status, lead_time_days')
        .order('name');
      
      if (suppError) throw suppError;

      // Fetch POs within time range
      const { data: pos, error: poError } = await supabase
        .from('purchase_orders')
        .select('id, supplier_id, status, total_amount, created_at')
        .gte('created_at', dateFilter);
      
      if (poError) throw poError;

      // Fetch GRNs within time range
      const { data: grns, error: grnError } = await supabase
        .from('goods_received_notes')
        .select('id, supplier_id, discrepancy_flag, total_items_expected, total_items_received, created_at')
        .gte('created_at', dateFilter);
      
      if (grnError) throw grnError;

      // Calculate metrics per supplier
      const metrics: SupplierMetrics[] = (suppliers || []).map(supplier => {
        const supplierPOs = (pos || []).filter(po => po.supplier_id === supplier.id);
        const supplierGRNs = (grns || []).filter(grn => grn.supplier_id === supplier.id);

        const completedPOs = supplierPOs.filter(po => po.status === 'completed').length;
        const cancelledPOs = supplierPOs.filter(po => po.status === 'cancelled').length;
        const pendingPOs = supplierPOs.filter(po => !['completed', 'cancelled'].includes(po.status)).length;
        
        const totalSpent = supplierPOs
          .filter(po => po.status === 'completed')
          .reduce((sum, po) => sum + (Number(po.total_amount) || 0), 0);

        const totalItemsOrdered = supplierGRNs.reduce((sum, grn) => sum + (grn.total_items_expected || 0), 0);
        const totalItemsReceived = supplierGRNs.reduce((sum, grn) => sum + (grn.total_items_received || 0), 0);

        return {
          id: supplier.id,
          name: supplier.name,
          rating: supplier.rating || 0,
          status: supplier.status,
          lead_time_days: supplier.lead_time_days || 7,
          totalPOs: supplierPOs.length,
          completedPOs,
          cancelledPOs,
          pendingPOs,
          totalGRNs: supplierGRNs.length,
          grnsWithDiscrepancies: supplierGRNs.filter(g => g.discrepancy_flag).length,
          totalSpent,
          totalItemsOrdered,
          totalItemsReceived,
        };
      });

      return metrics;
    }
  });

  // Calculate derived metrics
  const suppliersWithActivity = supplierMetrics.filter(s => s.totalPOs > 0 || s.totalGRNs > 0);
  
  const getCompletionRate = (s: SupplierMetrics) => 
    s.totalPOs > 0 ? (s.completedPOs / s.totalPOs) * 100 : 0;
  
  const getAccuracyRate = (s: SupplierMetrics) => 
    s.totalItemsOrdered > 0 ? (s.totalItemsReceived / s.totalItemsOrdered) * 100 : 100;
  
  const getDiscrepancyRate = (s: SupplierMetrics) => 
    s.totalGRNs > 0 ? (s.grnsWithDiscrepancies / s.totalGRNs) * 100 : 0;

  // Overall stats
  const overallStats = {
    totalSuppliers: supplierMetrics.length,
    activeSuppliers: suppliersWithActivity.length,
    totalPOs: supplierMetrics.reduce((sum, s) => sum + s.totalPOs, 0),
    completedPOs: supplierMetrics.reduce((sum, s) => sum + s.completedPOs, 0),
    totalGRNs: supplierMetrics.reduce((sum, s) => sum + s.totalGRNs, 0),
    totalSpent: supplierMetrics.reduce((sum, s) => sum + s.totalSpent, 0),
    avgCompletionRate: suppliersWithActivity.length > 0 
      ? suppliersWithActivity.reduce((sum, s) => sum + getCompletionRate(s), 0) / suppliersWithActivity.length 
      : 0,
    avgAccuracyRate: suppliersWithActivity.length > 0 
      ? suppliersWithActivity.reduce((sum, s) => sum + getAccuracyRate(s), 0) / suppliersWithActivity.length 
      : 0,
    topPerformers: suppliersWithActivity.filter(s => getCompletionRate(s) >= 80 && getAccuracyRate(s) >= 95).length,
    poorPerformers: suppliersWithActivity.filter(s => getCompletionRate(s) < 50 || getAccuracyRate(s) < 80).length,
  };

  // Chart data
  const chartData = suppliersWithActivity.map(s => ({
    name: s.name.length > 15 ? s.name.substring(0, 15) + '...' : s.name,
    completionRate: getCompletionRate(s),
    accuracyRate: getAccuracyRate(s),
  }));

  const spendData = suppliersWithActivity
    .filter(s => s.totalSpent > 0)
    .map(s => ({
      name: s.name.length > 15 ? s.name.substring(0, 15) + '...' : s.name,
      spent: s.totalSpent,
    }))
    .sort((a, b) => b.spent - a.spent);

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-3">
            <TrendingUp className="h-7 w-7 sm:h-8 sm:w-8 text-primary" />
            Supplier Performance Analytics
          </h1>
          <p className="text-muted-foreground text-sm sm:text-base">Track and analyze supplier reliability and quality</p>
        </div>
        <Tabs value={timeRange} onValueChange={setTimeRange} className="w-full sm:w-auto">
          <TabsList className="flex flex-wrap h-auto gap-1 w-full sm:w-auto">
            <TabsTrigger value="7" className="flex-1 sm:flex-none whitespace-normal text-xs sm:text-sm px-2 sm:px-3">7 Days</TabsTrigger>
            <TabsTrigger value="30" className="flex-1 sm:flex-none whitespace-normal text-xs sm:text-sm px-2 sm:px-3">30 Days</TabsTrigger>
            <TabsTrigger value="90" className="flex-1 sm:flex-none whitespace-normal text-xs sm:text-sm px-2 sm:px-3">90 Days</TabsTrigger>
            <TabsTrigger value="365" className="flex-1 sm:flex-none whitespace-normal text-xs sm:text-sm px-2 sm:px-3">1 Year</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Overall Stats */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Suppliers</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{overallStats.totalSuppliers}</div>
            <p className="text-xs text-muted-foreground">{overallStats.activeSuppliers} with activity</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <FileCheck className="h-4 w-4" />
              Purchase Orders
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{overallStats.totalPOs}</div>
            <p className="text-xs text-muted-foreground">{overallStats.completedPOs} completed</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <DollarSign className="h-4 w-4" />
              Total Spent
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatPrice(overallStats.totalSpent)}</div>
            <p className="text-xs text-muted-foreground">On completed POs</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Avg Completion Rate</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{overallStats.avgCompletionRate.toFixed(1)}%</div>
            <p className="text-xs text-muted-foreground">PO completion</p>
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
            <p className="text-xs text-muted-foreground">≥80% completion & ≥95% accuracy</p>
          </CardContent>
        </Card>
        <Card className="border-red-200 dark:border-red-900">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <XCircle className="h-4 w-4 text-red-600" />
              Need Attention
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{overallStats.poorPerformers}</div>
            <p className="text-xs text-muted-foreground">&lt;50% completion or &lt;80% accuracy</p>
          </CardContent>
        </Card>
      </div>

      {/* Performance Charts */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>PO Completion & Receiving Accuracy</CardTitle>
          </CardHeader>
          <CardContent>
            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" angle={-45} textAnchor="end" height={100} />
                  <YAxis domain={[0, 100]} />
                  <Tooltip formatter={(value: number) => `${value.toFixed(1)}%`} />
                  <Legend />
                  <Bar dataKey="completionRate" fill="#10b981" name="Completion %" />
                  <Bar dataKey="accuracyRate" fill="#3b82f6" name="Accuracy %" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[300px] text-muted-foreground">
                No data available for selected period
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Spending by Supplier</CardTitle>
          </CardHeader>
          <CardContent>
            {spendData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={spendData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" tickFormatter={(value) => formatPrice(value)} />
                  <YAxis dataKey="name" type="category" width={100} />
                  <Tooltip formatter={(value: number) => formatPrice(value)} />
                  <Bar dataKey="spent" fill="#f59e0b" name="Total Spent" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[300px] text-muted-foreground">
                No spending data for selected period
              </div>
            )}
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
          ) : supplierMetrics.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Package className="mx-auto h-12 w-12 mb-4 opacity-50" />
              <p>No suppliers found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-3 font-medium">Supplier</th>
                    <th className="text-left p-3 font-medium">Rating</th>
                    <th className="text-center p-3 font-medium">Total POs</th>
                    <th className="text-center p-3 font-medium">Completed</th>
                    <th className="text-center p-3 font-medium">Completion %</th>
                    <th className="text-center p-3 font-medium">GRNs</th>
                    <th className="text-center p-3 font-medium">Accuracy %</th>
                    <th className="text-center p-3 font-medium">Discrepancies</th>
                    <th className="text-right p-3 font-medium">Total Spent</th>
                    <th className="text-center p-3 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {supplierMetrics.map((supplier) => {
                    const completionRate = getCompletionRate(supplier);
                    const accuracyRate = getAccuracyRate(supplier);
                    const discrepancyRate = getDiscrepancyRate(supplier);
                    
                    return (
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
                        <td className="p-3 text-center">{supplier.totalPOs}</td>
                        <td className="p-3 text-center">{supplier.completedPOs}</td>
                        <td className="p-3 text-center">
                          {supplier.totalPOs > 0 ? (
                            <Badge variant={completionRate >= 80 ? 'default' : completionRate >= 50 ? 'secondary' : 'destructive'}>
                              {completionRate.toFixed(0)}%
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </td>
                        <td className="p-3 text-center">{supplier.totalGRNs}</td>
                        <td className="p-3 text-center">
                          {supplier.totalGRNs > 0 ? (
                            <Badge variant={accuracyRate >= 95 ? 'default' : accuracyRate >= 80 ? 'secondary' : 'destructive'}>
                              {accuracyRate.toFixed(0)}%
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </td>
                        <td className="p-3 text-center">
                          {supplier.totalGRNs > 0 ? (
                            <Badge variant={discrepancyRate <= 10 ? 'default' : discrepancyRate <= 25 ? 'secondary' : 'destructive'}>
                              {supplier.grnsWithDiscrepancies} ({discrepancyRate.toFixed(0)}%)
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </td>
                        <td className="p-3 text-right font-medium">
                          {supplier.totalSpent > 0 ? formatPrice(supplier.totalSpent) : '-'}
                        </td>
                        <td className="p-3 text-center">
                          <Badge variant={supplier.status === 'active' ? 'default' : 'secondary'}>
                            {supplier.status}
                          </Badge>
                        </td>
                      </tr>
                    );
                  })}
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
