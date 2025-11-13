import React, { useState, memo, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { DateRange } from 'react-day-picker';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { GradientCard } from "@/components/ui/gradient-card";
import { ModernButton } from "@/components/ui/modern-button";
import { StatusBadge } from "@/components/ui/status-badge";
import { OptimizedSalesChart } from "@/components/charts/OptimizedSalesChart";
import { CourierPerformanceChart } from "@/components/charts/CourierPerformanceChart";
import { StaffPerformanceChart } from "@/components/charts/StaffPerformanceChart";
import { InventoryValueChart } from "@/components/charts/InventoryValueChart";
import { OrderStatusChart } from "@/components/charts/OrderStatusChart";
import { DatePickerWithRange } from "@/components/DatePickerWithRange";
import { InventorySummaryWidget } from "@/components/inventory/InventorySummaryWidget";
import { RecentActivityFeed } from "@/components/dashboard/RecentActivityFeed";
import { AlertsSummary } from "@/components/dashboard/AlertsSummary";
import { TopPerformers } from "@/components/dashboard/TopPerformers";
import { PerformanceMetrics } from "@/components/dashboard/PerformanceMetrics";
import { useToast } from "@/hooks/use-toast";
import { Calendar, Package, Truck, CheckCircle, XCircle, RotateCcw, TrendingUp, TrendingDown, Users, BarChart3, Upload, FileText, Settings, UserCog } from "lucide-react";
import { supabase } from '@/integrations/supabase/client';

// Memoized summary card component for better performance
const SummaryCard = memo(({
  item,
  index
}: {
  item: any;
  index: number;
}) => {
  const Icon = item.icon;
  const isPositive = item.trend === "up";
  return <GradientCard key={index} className="p-0 overflow-hidden hover:scale-105 transition-transform duration-300">
      <div className={`h-2 bg-gradient-to-r ${item.color}`}></div>
      <CardContent className="p-4 sm:p-6">
        <div className="flex items-start justify-between">
          <div className="space-y-2 flex-1">
            <p className="text-sm font-medium text-muted-foreground">
              {item.title}
            </p>
            <p className="text-2xl sm:text-3xl font-bold text-foreground">
              {item.value}
            </p>
            <div className="flex items-center gap-2">
              {isPositive ? <TrendingUp className="h-4 w-4 text-green-500" /> : <TrendingDown className="h-4 w-4 text-red-500" />}
              <span className={`text-sm font-medium ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
                {item.change}
              </span>
            </div>
          </div>
          <div className={`p-3 rounded-xl bg-gradient-to-r ${item.color} shadow-lg`}>
            <Icon className="h-5 w-5 sm:h-6 sm:w-6 text-primary-foreground" />
          </div>
        </div>
      </CardContent>
    </GradientCard>;
});
SummaryCard.displayName = 'SummaryCard';
const Dashboard = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);

  // Optimized data fetching with React Query and aggregation
  const { data: dashboardData, isLoading: loading } = useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: async () => {
      const [ordersRes, returnsRes, customersRes] = await Promise.all([
        supabase.from('orders').select('status', { count: 'exact', head: false }),
        supabase.from('returns').select('return_status', { count: 'exact', head: false }),
        supabase.from('customers').select('id', { count: 'exact', head: true })
      ]);

      if (ordersRes.error || returnsRes.error || customersRes.error) {
        throw new Error('Failed to fetch dashboard data');
      }

      const orders = ordersRes.data || [];
      const returns = returnsRes.data || [];
      
      return {
        totalOrders: orders.length,
        bookedOrders: orders.filter(o => o.status === 'booked').length,
        dispatchedOrders: orders.filter(o => o.status === 'dispatched').length,
        deliveredOrders: orders.filter(o => o.status === 'delivered').length,
        cancelledOrders: orders.filter(o => o.status === 'cancelled').length,
        returnsInTransit: returns.filter(r => r.return_status === 'in_transit').length,
        returnedOrders: returns.filter(r => r.return_status === 'received').length,
        customers: customersRes.count || 0
      };
    },
    refetchInterval: 30000, // Refresh every 30 seconds
    staleTime: 20000, // Consider data fresh for 20 seconds
  });

  // Memoize summary data with real data
  const summaryData = useMemo(() => [{
    title: "Total Orders",
    value: loading ? "..." : (dashboardData?.totalOrders || 0).toLocaleString(),
    change: "+12.5%",
    trend: "up",
    icon: Package,
    color: "from-blue-500 to-cyan-500"
  }, {
    title: "Booked Orders",
    value: loading ? "..." : (dashboardData?.bookedOrders || 0).toLocaleString(),
    change: "+8.2%",
    trend: "up",
    icon: Calendar,
    color: "from-purple-500 to-pink-500"
  }, {
    title: "Dispatched Orders",
    value: loading ? "..." : (dashboardData?.dispatchedOrders || 0).toLocaleString(),
    change: "+15.7%",
    trend: "up",
    icon: Truck,
    color: "from-orange-500 to-yellow-500"
  }, {
    title: "Delivered Orders",
    value: loading ? "..." : (dashboardData?.deliveredOrders || 0).toLocaleString(),
    change: "+18.3%",
    trend: "up",
    icon: CheckCircle,
    color: "from-green-500 to-emerald-500"
  }, {
    title: "Cancelled Orders",
    value: loading ? "..." : (dashboardData?.cancelledOrders || 0).toLocaleString(),
    change: "-23.1%",
    trend: "down",
    icon: XCircle,
    color: "from-red-500 to-pink-500"
  }, {
    title: "Returns in Transit",
    value: loading ? "..." : (dashboardData?.returnsInTransit || 0).toLocaleString(),
    change: "+5.4%",
    trend: "up",
    icon: RotateCcw,
    color: "from-indigo-500 to-purple-500"
  }, {
    title: "Returned Orders",
    value: loading ? "..." : (dashboardData?.returnedOrders || 0).toLocaleString(),
    change: "-12.8%",
    trend: "down",
    icon: Package,
    color: "from-gray-500 to-gray-600"
  }, {
    title: "Customers",
    value: loading ? "..." : (dashboardData?.customers || 0).toLocaleString(),
    change: "+9.7%",
    trend: "up",
    icon: Users,
    color: "from-teal-500 to-blue-500"
  }], [dashboardData, loading]);

  // Handler functions for button actions
  const handleExportReport = () => {
    const startDate = dateRange?.from?.toLocaleDateString() || 'all-time';
    const endDate = dateRange?.to?.toLocaleDateString() || 'current';
    
    // Generate CSV content
    const csvData = [
      ['Metric', 'Value', 'Change'],
      ...summaryData.map(item => [item.title, item.value, item.change])
    ];
    
    const csvContent = csvData.map(row => row.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `dashboard-report-${startDate}-to-${endDate}.csv`;
    link.click();
    window.URL.revokeObjectURL(url);
    
    toast({
      title: "Report Exported",
      description: `Dashboard report for ${startDate} to ${endDate} has been downloaded.`,
    });
  };

  const handleBulkUpload = () => {
    navigate('/orders');
    toast({
      title: "Bulk Upload",
      description: "Redirecting to orders page for bulk upload functionality.",
    });
  };

  const handleGenerateReport = () => {
    handleExportReport();
  };

  const handleManageUsers = () => {
    navigate('/user-management');
    toast({
      title: "User Management",
      description: "Redirecting to user management page.",
    });
  };

  const handleSystemSettings = () => {
    navigate('/settings');
    toast({
      title: "System Settings",
      description: "Redirecting to system settings page.",
    });
  };

  const courierData = useMemo(() => [{
    name: "Leopard Success Rate",
    rate: "94.2%",
    status: "success"
  }, {
    name: "PostEx Success Rate",
    rate: "91.5%",
    status: "success"
  }], []);
  return <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-purple-50 dark:from-gray-900 dark:via-purple-900/20 dark:to-gray-900">
      <div className="p-4 sm:p-6 lg:p-8 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-responsive-xl font-bold gradient-text mb-2">
              Ecomnet Portal Dashboard
            </h1>
            <p className="text-responsive-sm text-muted-foreground">
              Comprehensive order management and analytics platform
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-3">
            <DatePickerWithRange date={dateRange} setDate={setDateRange} />
            <ModernButton 
              variant="default" 
              className="whitespace-nowrap"
              onClick={handleExportReport}
            >
              <BarChart3 className="h-4 w-4" />
              Export Report
            </ModernButton>
          </div>
        </div>

        {/* Summary Cards Grid - Optimized rendering */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">
          {summaryData.map((item, index) => <SummaryCard key={item.title} item={item} index={index} />)}
        </div>

        {/* Courier Performance Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {courierData.map((courier, index) => <GradientCard key={courier.name} variant="glass" className="p-4 sm:p-6 text-center">
              <h3 className="font-semibold text-sm sm:text-base mb-2 text-foreground">
                {courier.name}
              </h3>
              <p className="text-xl sm:text-2xl font-bold mb-2 text-foreground">
                {courier.rate}
              </p>
              <StatusBadge variant={courier.status as "success" | "destructive"} className="mx-auto">
                Excellent
              </StatusBadge>
            </GradientCard>)}
        </div>

        {/* Inventory Summary Widget */}
        <InventorySummaryWidget />

        {/* Real-time Activity and Alerts */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          <RecentActivityFeed />
          <AlertsSummary />
        </div>

        {/* Top Performers and System Metrics */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          <TopPerformers />
          <PerformanceMetrics />
        </div>

        {/* Charts Section - Enhanced Analytics */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          <GradientCard className="p-0 overflow-hidden">
            <CardHeader className="bg-gradient-to-r from-blue-500/10 to-purple-500/10 dark:from-blue-500/20 dark:to-purple-500/20">
              <CardTitle className="text-responsive-lg">Sales Trends</CardTitle>
              <CardDescription>Daily sales performance and order volume</CardDescription>
            </CardHeader>
            <CardContent className="p-4 sm:p-6">
              <OptimizedSalesChart />
            </CardContent>
          </GradientCard>

          <GradientCard className="p-0 overflow-hidden">
            <CardHeader className="bg-gradient-to-r from-green-500/10 to-emerald-500/10 dark:from-green-500/20 dark:to-emerald-500/20">
              <CardTitle className="text-responsive-lg">Courier Performance</CardTitle>
              <CardDescription>Success vs failure rates by courier service</CardDescription>
            </CardHeader>
            <CardContent className="p-4 sm:p-6">
              <CourierPerformanceChart />
            </CardContent>
          </GradientCard>

          <GradientCard className="p-0 overflow-hidden">
            <CardHeader className="bg-gradient-to-r from-orange-500/10 to-red-500/10 dark:from-orange-500/20 dark:to-red-500/20">
              <CardTitle className="text-responsive-lg">Staff Performance</CardTitle>
              <CardDescription>Team productivity metrics (Last 7 days)</CardDescription>
            </CardHeader>
            <CardContent className="p-4 sm:p-6">
              <StaffPerformanceChart />
            </CardContent>
          </GradientCard>

          <GradientCard className="p-0 overflow-hidden">
            <CardHeader className="bg-gradient-to-r from-purple-500/10 to-pink-500/10 dark:from-purple-500/20 dark:to-pink-500/20">
              <CardTitle className="text-responsive-lg">Inventory Value by Outlet</CardTitle>
              <CardDescription>Total stock value across locations</CardDescription>
            </CardHeader>
            <CardContent className="p-4 sm:p-6">
              <InventoryValueChart />
            </CardContent>
          </GradientCard>

          <GradientCard className="p-0 overflow-hidden">
            <CardHeader className="bg-gradient-to-r from-cyan-500/10 to-blue-500/10 dark:from-cyan-500/20 dark:to-blue-500/20">
              <CardTitle className="text-responsive-lg">Order Status Distribution</CardTitle>
              <CardDescription>Current orders breakdown by status</CardDescription>
            </CardHeader>
            <CardContent className="p-4 sm:p-6">
              <OrderStatusChart />
            </CardContent>
          </GradientCard>
        </div>

        {/* Quick Actions */}
        <GradientCard variant="primary" className="p-6 text-center bg-background/95">
          <h2 className="text-responsive-lg font-bold text-foreground mb-4">
            Quick Actions
          </h2>
          <div className="flex flex-wrap justify-center gap-3">
            <ModernButton 
              variant="outline" 
              onClick={handleBulkUpload}
            >
              <Upload className="h-4 w-4 mr-2" />
              Bulk Upload Orders
            </ModernButton>
            <ModernButton 
              variant="outline" 
              onClick={handleGenerateReport}
            >
              <FileText className="h-4 w-4 mr-2" />
              Generate Report
            </ModernButton>
            <ModernButton 
              variant="outline" 
              onClick={handleManageUsers}
            >
              <UserCog className="h-4 w-4 mr-2" />
              Manage Users
            </ModernButton>
            <ModernButton 
              variant="outline" 
              onClick={handleSystemSettings}
            >
              <Settings className="h-4 w-4 mr-2" />
              System Settings
            </ModernButton>
          </div>
        </GradientCard>
      </div>
    </div>;
};
export default Dashboard;