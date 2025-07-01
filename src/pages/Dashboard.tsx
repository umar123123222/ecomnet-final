
import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Calendar, Package, Truck, CheckCircle, XCircle, RotateCcw, ArrowLeft, TrendingUp, Users } from 'lucide-react';
import { DatePickerWithRange } from '@/components/DatePickerWithRange';
import { SalesChart } from '@/components/charts/SalesChart';
import { CourierPerformanceChart } from '@/components/charts/CourierPerformanceChart';

const Dashboard = () => {
  const [dateRange, setDateRange] = useState<any>(null);

  const summaryData = [
    { title: 'Total Orders', value: '2,847', icon: Package, color: 'bg-blue-500', change: '+12%' },
    { title: 'Booked Orders', value: '1,234', icon: Calendar, color: 'bg-orange-500', change: '+8%' },
    { title: 'Dispatched Orders', value: '987', icon: Truck, color: 'bg-purple-500', change: '+15%' },
    { title: 'Delivered Orders', value: '2,156', icon: CheckCircle, color: 'bg-green-500', change: '+5%' },
    { title: 'Cancelled Orders', value: '89', icon: XCircle, color: 'bg-red-500', change: '-3%' },
    { title: 'Returns in Transit', value: '45', icon: RotateCcw, color: 'bg-yellow-500', change: '+2%' },
    { title: 'Returned Orders', value: '123', icon: ArrowLeft, color: 'bg-gray-500', change: '-1%' },
    { title: 'Leopard Success Rate', value: '94.2%', icon: TrendingUp, color: 'bg-emerald-500', change: '+1.2%' },
    { title: 'Leopard Failed Rate', value: '5.8%', icon: XCircle, color: 'bg-red-400', change: '-0.8%' },
    { title: 'PostEx Success Rate', value: '91.5%', icon: TrendingUp, color: 'bg-blue-600', change: '+0.5%' },
    { title: 'PostEx Failed Rate', value: '8.5%', icon: XCircle, color: 'bg-red-400', change: '-0.3%' },
    { title: 'User Performance', value: '87%', icon: Users, color: 'bg-indigo-500', change: '+3%' },
  ];

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-600 mt-1">Overview of your order management system</p>
        </div>
        <div className="flex items-center gap-3">
          <DatePickerWithRange date={dateRange} setDate={setDateRange} />
          <Button>
            Export Report
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {summaryData.map((item, index) => (
          <Card key={index} className="hover:shadow-md transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">
                {item.title}
              </CardTitle>
              <div className={`${item.color} p-2 rounded-md`}>
                <item.icon className="h-4 w-4 text-white" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-gray-900">{item.value}</div>
              <p className="text-xs text-green-600 mt-1">
                {item.change} from last month
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Sales Trends</CardTitle>
            <CardDescription>Daily sales performance over time</CardDescription>
          </CardHeader>
          <CardContent>
            <SalesChart />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Courier Performance</CardTitle>
            <CardDescription>Delivery success rates by courier</CardDescription>
          </CardHeader>
          <CardContent>
            <CourierPerformanceChart />
          </CardContent>
        </Card>
      </div>

      {/* High Return Products */}
      <Card>
        <CardHeader>
          <CardTitle>High-Return Products</CardTitle>
          <CardDescription>Products with highest return volumes</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[
              { name: 'Product A', returns: 45, total: 200, rate: '22.5%' },
              { name: 'Product B', returns: 38, total: 180, rate: '21.1%' },
              { name: 'Product C', returns: 32, total: 160, rate: '20.0%' },
              { name: 'Product D', returns: 28, total: 150, rate: '18.7%' },
            ].map((product, index) => (
              <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div>
                  <p className="font-medium">{product.name}</p>
                  <p className="text-sm text-gray-600">{product.returns} of {product.total} orders</p>
                </div>
                <span className="text-red-600 font-semibold">{product.rate}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Dashboard;
