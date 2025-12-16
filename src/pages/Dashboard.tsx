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
import { SyncStatusWidget } from "@/components/dashboard/SyncStatusWidget";
import { AlertsWidget } from "@/components/dashboard/AlertsWidget";
import { TopPerformers } from "@/components/dashboard/TopPerformers";
import { PerformanceMetrics } from "@/components/dashboard/PerformanceMetrics";
import { DeficitProductsWidget } from "@/components/dashboard/DeficitProductsWidget";
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

  // Calculate date ranges for current and previous periods
  const getDateRanges = () => {
    const now = new Date();
    let currentStart: Date, currentEnd: Date, previousStart: Date, previousEnd: Date;

    if (dateRange?.from && dateRange?.to) {
      currentStart = dateRange.from;
      currentEnd = dateRange.to;
      const duration = currentEnd.getTime() - currentStart.getTime();
      previousEnd = new Date(currentStart.getTime() - 1);
      previousStart = new Date(previousEnd.getTime() - duration);
    } else {
      // Default: last 30 days vs previous 30 days
      currentEnd = now;
      currentStart = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      previousEnd = new Date(currentStart.getTime() - 1);
      previousStart = new Date(previousEnd.getTime() - 30 * 24 * 60 * 60 * 1000);
    }

    return {
      currentStart: currentStart.toISOString(),
      currentEnd: currentEnd.toISOString(),
      previousStart: previousStart.toISOString(),
      previousEnd: previousEnd.toISOString(),
    };
  };

  // Optimized data fetching - uses single aggregated DB function (was 21 queries, now 1)
  const { data: dashboardData, isLoading: loading } = useQuery({
    queryKey: ['dashboard-stats-optimized', dateRange],
    queryFn: async () => {
      const ranges = getDateRanges();

      // Use optimized RPC function for stats
      const [allTimeResult, currentResult, previousResult] = await Promise.all([
        supabase.rpc('get_dashboard_stats'),
        supabase.rpc('get_dashboard_stats', {
          p_start_date: ranges.currentStart,
          p_end_date: ranges.currentEnd,
        }),
        supabase.rpc('get_dashboard_stats', {
          p_start_date: ranges.previousStart,
          p_end_date: ranges.previousEnd,
        }),
      ]);

      if (allTimeResult.error) throw allTimeResult.error;

      const allTimeData = allTimeResult.data as any;
      const currentData = (currentResult.data || {}) as any;
      const previousData = (previousResult.data || {}) as any;

      const calculateTrend = (current: number, previous: number) => {
        if (previous === 0) return current > 0 ? 100 : 0;
        return ((current - previous) / previous) * 100;
      };

      const getCounts = (data: any) => ({
        totalOrders: data?.total_orders || 0,
        bookedOrders: data?.order_counts?.booked || 0,
        dispatchedOrders: data?.order_counts?.dispatched || 0,
        deliveredOrders: data?.order_counts?.delivered || 0,
        cancelledOrders: data?.order_counts?.cancelled || 0,
        returnedOrders: data?.order_counts?.returned || 0,
        pendingOrders: (data?.order_counts?.pending || 0) + (data?.order_counts?.confirmed || 0),
        customers: data?.total_customers || 0,
      });

      const allTimeStats = getCounts(allTimeData);
      const currentStats = getCounts(currentData);
      const previousStats = getCounts(previousData);

      return {
        allTime: allTimeStats,
        current: currentStats,
        previous: previousStats,
        trends: {
          totalOrders: calculateTrend(currentStats.totalOrders, previousStats.totalOrders),
          bookedOrders: calculateTrend(currentStats.bookedOrders, previousStats.bookedOrders),
          dispatchedOrders: calculateTrend(currentStats.dispatchedOrders, previousStats.dispatchedOrders),
          deliveredOrders: calculateTrend(currentStats.deliveredOrders, previousStats.deliveredOrders),
          cancelledOrders: calculateTrend(currentStats.cancelledOrders, previousStats.cancelledOrders),
          returnedOrders: calculateTrend(currentStats.returnedOrders, previousStats.returnedOrders),
          pendingOrders: calculateTrend(currentStats.pendingOrders, previousStats.pendingOrders),
          customers: calculateTrend(currentStats.customers, previousStats.customers),
        },
      };
    },
    refetchInterval: 300000, // Reduced from 30s to 5 minutes
    staleTime: 240000, // 4 minutes stale time
  });

  // Format trend percentage
  const formatTrend = (value: number) => {
    const sign = value >= 0 ? '+' : '';
    return `${sign}${value.toFixed(1)}%`;
  };

  // Memoize summary data with real all-time data and calculated trends
  const summaryData = useMemo(() => {
    if (loading || !dashboardData) {
      return [{
        title: "Total Orders",
        value: "...",
        change: "...",
        trend: "up",
        icon: Package,
        color: "from-blue-500 to-cyan-500"
      }, {
        title: "Booked Orders",
        value: "...",
        change: "...",
        trend: "up",
        icon: Calendar,
        color: "from-purple-500 to-pink-500"
      }, {
        title: "Dispatched Orders",
        value: "...",
        change: "...",
        trend: "up",
        icon: Truck,
        color: "from-orange-500 to-yellow-500"
      }, {
        title: "Delivered Orders",
        value: "...",
        change: "...",
        trend: "up",
        icon: CheckCircle,
        color: "from-green-500 to-emerald-500"
      }, {
        title: "Cancelled Orders",
        value: "...",
        change: "...",
        trend: "up",
        icon: XCircle,
        color: "from-red-500 to-pink-500"
      }, {
        title: "Returned Orders",
        value: "...",
        change: "...",
        trend: "up",
        icon: RotateCcw,
        color: "from-indigo-500 to-purple-500"
      }, {
        title: "Pending Orders",
        value: "...",
        change: "...",
        trend: "up",
        icon: Package,
        color: "from-gray-500 to-gray-600"
      }, {
        title: "Customers",
        value: "...",
        change: "...",
        trend: "up",
        icon: Users,
        color: "from-teal-500 to-blue-500"
      }];
    }

    // Use all-time stats for display, trends from period comparison
    return [{
      title: "Total Orders",
      value: (dashboardData.allTime.totalOrders || 0).toLocaleString(),
      change: formatTrend(dashboardData.trends.totalOrders),
      trend: dashboardData.trends.totalOrders >= 0 ? "up" : "down",
      icon: Package,
      color: "from-blue-500 to-cyan-500"
    }, {
      title: "Booked Orders",
      value: (dashboardData.allTime.bookedOrders || 0).toLocaleString(),
      change: formatTrend(dashboardData.trends.bookedOrders),
      trend: dashboardData.trends.bookedOrders >= 0 ? "up" : "down",
      icon: Calendar,
      color: "from-purple-500 to-pink-500"
    }, {
      title: "Dispatched Orders",
      value: (dashboardData.allTime.dispatchedOrders || 0).toLocaleString(),
      change: formatTrend(dashboardData.trends.dispatchedOrders),
      trend: dashboardData.trends.dispatchedOrders >= 0 ? "up" : "down",
      icon: Truck,
      color: "from-orange-500 to-yellow-500"
    }, {
      title: "Delivered Orders",
      value: (dashboardData.allTime.deliveredOrders || 0).toLocaleString(),
      change: formatTrend(dashboardData.trends.deliveredOrders),
      trend: dashboardData.trends.deliveredOrders >= 0 ? "up" : "down",
      icon: CheckCircle,
      color: "from-green-500 to-emerald-500"
    }, {
      title: "Cancelled Orders",
      value: (dashboardData.allTime.cancelledOrders || 0).toLocaleString(),
      change: formatTrend(dashboardData.trends.cancelledOrders),
      trend: dashboardData.trends.cancelledOrders >= 0 ? "up" : "down",
      icon: XCircle,
      color: "from-red-500 to-pink-500"
    }, {
      title: "Returned Orders",
      value: (dashboardData.allTime.returnedOrders || 0).toLocaleString(),
      change: formatTrend(dashboardData.trends.returnedOrders),
      trend: dashboardData.trends.returnedOrders >= 0 ? "up" : "down",
      icon: RotateCcw,
      color: "from-indigo-500 to-purple-500"
    }, {
      title: "Pending Orders",
      value: (dashboardData.allTime.pendingOrders || 0).toLocaleString(),
      change: formatTrend(dashboardData.trends.pendingOrders),
      trend: dashboardData.trends.pendingOrders >= 0 ? "up" : "down",
      icon: Package,
      color: "from-gray-500 to-gray-600"
    }, {
      title: "Customers",
      value: (dashboardData.allTime.customers || 0).toLocaleString(),
      change: formatTrend(dashboardData.trends.customers),
      trend: dashboardData.trends.customers >= 0 ? "up" : "down",
      icon: Users,
      color: "from-teal-500 to-blue-500"
    }];
  }, [dashboardData, loading]);

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

  // Fetch dynamic courier performance data
  const { data: courierData = [] } = useQuery({
    queryKey: ['courier-performance', dateRange],
    queryFn: async () => {
      const { data: orders, error } = await supabase
        .from('orders')
        .select('courier, status')
        .not('courier', 'is', null)
        .in('status', ['delivered', 'returned', 'cancelled']);
      
      if (error) throw error;
      
      // Group by courier and calculate success rates
      const courierStats: Record<string, { delivered: number; total: number }> = {};
      
      orders?.forEach(order => {
        if (!order.courier) return;
        if (!courierStats[order.courier]) {
          courierStats[order.courier] = { delivered: 0, total: 0 };
        }
        courierStats[order.courier].total++;
        if (order.status === 'delivered') {
          courierStats[order.courier].delivered++;
        }
      });
      
      return Object.entries(courierStats).map(([name, stats]) => {
        const rate = stats.total > 0 ? ((stats.delivered / stats.total) * 100).toFixed(1) : '0.0';
        const rateNum = parseFloat(rate);
        return {
          name: `${name.charAt(0).toUpperCase() + name.slice(1)} Success Rate`,
          rate: `${rate}%`,
          status: rateNum >= 90 ? 'success' : rateNum >= 75 ? 'warning' : 'destructive',
          label: rateNum >= 90 ? 'Excellent' : rateNum >= 75 ? 'Good' : 'Needs Improvement'
        };
      });
    },
    staleTime: 5 * 60 * 1000,
  });
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
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {courierData.length > 0 ? courierData.map((courier) => <GradientCard key={courier.name} variant="glass" className="p-4 sm:p-6 text-center">
              <h3 className="font-semibold text-sm sm:text-base mb-2 text-foreground">
                {courier.name}
              </h3>
              <p className="text-xl sm:text-2xl font-bold mb-2 text-foreground">
                {courier.rate}
              </p>
              <StatusBadge variant={courier.status as "success" | "warning" | "destructive"} className="mx-auto">
                {courier.label}
              </StatusBadge>
            </GradientCard>) : (
            <GradientCard variant="glass" className="p-4 sm:p-6 text-center col-span-full">
              <p className="text-muted-foreground">No courier performance data available</p>
            </GradientCard>
          )}
        </div>

        {/* Inventory Summary Widget */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          <InventorySummaryWidget />
          <DeficitProductsWidget />
        </div>

        {/* Real-time Activity, Alerts, and Sync Status */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          <RecentActivityFeed />
          <SyncStatusWidget />
          <AlertsWidget />
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