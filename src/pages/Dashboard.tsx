
import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { GradientCard } from "@/components/ui/gradient-card";
import { ModernButton } from "@/components/ui/modern-button";
import { StatusBadge } from "@/components/ui/status-badge";
import { SalesChart } from "@/components/charts/SalesChart";
import { CourierPerformanceChart } from "@/components/charts/CourierPerformanceChart";
import { DatePickerWithRange } from "@/components/DatePickerWithRange";
import { Calendar, Package, Truck, CheckCircle, XCircle, RotateCcw, TrendingUp, TrendingDown, Users, BarChart3 } from "lucide-react";

const Dashboard = () => {
  const [dateRange, setDateRange] = useState<{from: Date | undefined; to: Date | undefined}>({
    from: undefined,
    to: undefined
  });

  const summaryData = [
    { title: "Total Orders", value: "2,847", change: "+12.5%", trend: "up", icon: Package, color: "from-blue-500 to-cyan-500" },
    { title: "Booked Orders", value: "1,234", change: "+8.2%", trend: "up", icon: Calendar, color: "from-purple-500 to-pink-500" },
    { title: "Dispatched Orders", value: "987", change: "+15.7%", trend: "up", icon: Truck, color: "from-orange-500 to-yellow-500" },
    { title: "Delivered Orders", value: "856", change: "+18.3%", trend: "up", icon: CheckCircle, color: "from-green-500 to-emerald-500" },
    { title: "Cancelled Orders", value: "45", change: "-23.1%", trend: "down", icon: XCircle, color: "from-red-500 to-pink-500" },
    { title: "Returns in Transit", value: "23", change: "+5.4%", trend: "up", icon: RotateCcw, color: "from-indigo-500 to-purple-500" },
    { title: "Returned Orders", value: "12", change: "-12.8%", trend: "down", icon: Package, color: "from-gray-500 to-gray-600" },
    { title: "Active Users", value: "156", change: "+9.7%", trend: "up", icon: Users, color: "from-teal-500 to-blue-500" },
  ];

  const courierData = [
    { name: "Leopard Success Rate", rate: "94.2%", status: "success" },
    { name: "PostEx Success Rate", rate: "91.5%", status: "success" },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-purple-50 dark:from-gray-900 dark:via-purple-900/20 dark:to-gray-900">
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
            <ModernButton variant="default" className="whitespace-nowrap">
              <BarChart3 className="h-4 w-4" />
              Export Report
            </ModernButton>
          </div>
        </div>

        {/* Summary Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">
          {summaryData.map((item, index) => {
            const Icon = item.icon;
            const isPositive = item.trend === "up";
            
            return (
              <GradientCard key={index} className="p-0 overflow-hidden hover:scale-105 transition-transform duration-300">
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
                        {isPositive ? (
                          <TrendingUp className="h-4 w-4 text-green-500" />
                        ) : (
                          <TrendingDown className="h-4 w-4 text-red-500" />
                        )}
                        <span className={`text-sm font-medium ${
                          isPositive ? 'text-green-600' : 'text-red-600'
                        }`}>
                          {item.change}
                        </span>
                      </div>
                    </div>
                    <div className={`p-3 rounded-xl bg-gradient-to-r ${item.color} shadow-lg`}>
                      <Icon className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
                    </div>
                  </div>
                </CardContent>
              </GradientCard>
            );
          })}
        </div>

        {/* Courier Performance Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {courierData.map((courier, index) => (
            <GradientCard key={index} variant="glass" className="p-4 sm:p-6 text-center">
              <h3 className="font-semibold text-sm sm:text-base mb-2 text-foreground">
                {courier.name}
              </h3>
              <p className="text-xl sm:text-2xl font-bold mb-2 text-foreground">
                {courier.rate}
              </p>
              <StatusBadge 
                variant={courier.status as "success" | "destructive"} 
                className="mx-auto"
              >
                Excellent
              </StatusBadge>
            </GradientCard>
          ))}
        </div>

        {/* Charts Section */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          <GradientCard className="p-0 overflow-hidden">
            <CardHeader className="bg-gradient-to-r from-blue-500/10 to-purple-500/10 dark:from-blue-500/20 dark:to-purple-500/20">
              <CardTitle className="text-responsive-lg">Sales Trends</CardTitle>
              <CardDescription>Daily sales performance and order volume</CardDescription>
            </CardHeader>
            <CardContent className="p-4 sm:p-6">
              <SalesChart />
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
        </div>

        {/* Quick Actions */}
        <GradientCard variant="primary" className="p-6 text-center">
          <h2 className="text-responsive-lg font-bold text-white mb-4">
            Quick Actions
          </h2>
          <div className="flex flex-wrap justify-center gap-3">
            <ModernButton variant="outline" className="bg-white/10 border-white/20 text-white hover:bg-white/20">
              Bulk Upload Orders
            </ModernButton>
            <ModernButton variant="outline" className="bg-white/10 border-white/20 text-white hover:bg-white/20">
              Generate Report
            </ModernButton>
            <ModernButton variant="outline" className="bg-white/10 border-white/20 text-white hover:bg-white/20">
              Manage Users
            </ModernButton>
            <ModernButton variant="outline" className="bg-white/10 border-white/20 text-white hover:bg-white/20">
              System Settings
            </ModernButton>
          </div>
        </GradientCard>
      </div>
    </div>
  );
};

export default Dashboard;
