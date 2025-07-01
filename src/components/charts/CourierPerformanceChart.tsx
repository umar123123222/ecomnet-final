
import React, { useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { ModernButton } from "@/components/ui/modern-button";

// Sample data for different time periods
const dailyData = [
  { period: 'Mon', success: 145, failed: 12 },
  { period: 'Tue', success: 189, failed: 8 },
  { period: 'Wed', success: 167, failed: 15 },
  { period: 'Thu', success: 203, failed: 9 },
  { period: 'Fri', success: 178, failed: 18 },
  { period: 'Sat', success: 156, failed: 11 },
  { period: 'Sun', success: 134, failed: 7 },
];

const weeklyData = [
  { period: 'Week 1', success: 1247, failed: 89 },
  { period: 'Week 2', success: 1356, failed: 67 },
  { period: 'Week 3', success: 1189, failed: 92 },
  { period: 'Week 4', success: 1423, failed: 78 },
];

const monthlyData = [
  { period: 'Jan', success: 4567, failed: 234 },
  { period: 'Feb', success: 5123, failed: 189 },
  { period: 'Mar', success: 4789, failed: 267 },
  { period: 'Apr', success: 5234, failed: 198 },
  { period: 'May', success: 4956, failed: 223 },
  { period: 'Jun', success: 5456, failed: 178 },
];

export const CourierPerformanceChart = () => {
  const [selectedPeriod, setSelectedPeriod] = useState<'days' | 'weeks' | 'months'>('days');

  const getData = () => {
    switch (selectedPeriod) {
      case 'weeks':
        return weeklyData;
      case 'months':
        return monthlyData;
      default:
        return dailyData;
    }
  };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const total = payload[0].value + payload[1].value;
      const successRate = ((payload[0].value / total) * 100).toFixed(1);
      
      return (
        <div className="bg-white p-3 border border-gray-200 rounded-lg shadow-lg">
          <p className="font-medium text-gray-900 mb-2">{label}</p>
          <div className="space-y-1">
            <p className="flex items-center gap-2">
              <span className="w-3 h-3 bg-green-500 rounded"></span>
              <span className="text-sm">Success: {payload[0].value}</span>
            </p>
            <p className="flex items-center gap-2">
              <span className="w-3 h-3 bg-red-500 rounded"></span>
              <span className="text-sm">Failed: {payload[1].value}</span>
            </p>
            <p className="text-sm font-medium text-gray-600 pt-1 border-t">
              Success Rate: {successRate}%
            </p>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="space-y-4">
      {/* Time Period Selection */}
      <div className="flex gap-2">
        <ModernButton
          variant={selectedPeriod === 'days' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setSelectedPeriod('days')}
        >
          Days
        </ModernButton>
        <ModernButton
          variant={selectedPeriod === 'weeks' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setSelectedPeriod('weeks')}
        >
          Weeks
        </ModernButton>
        <ModernButton
          variant={selectedPeriod === 'months' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setSelectedPeriod('months')}
        >
          Months
        </ModernButton>
      </div>

      {/* Chart */}
      <div className="h-[300px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={getData()} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis 
              dataKey="period" 
              stroke="#666" 
              fontSize={12}
            />
            <YAxis 
              stroke="#666" 
              fontSize={12}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend />
            <Bar 
              dataKey="success" 
              fill="#10b981" 
              name="Delivery Success"
              radius={[4, 4, 0, 0]} 
            />
            <Bar 
              dataKey="failed" 
              fill="#ef4444" 
              name="Delivery Failed"
              radius={[4, 4, 0, 0]} 
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};
