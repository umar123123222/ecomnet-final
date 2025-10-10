import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Activity, Zap, Database, TrendingUp } from 'lucide-react';

export const PerformanceMetrics: React.FC = () => {
  // In a real app, these would come from monitoring services
  const metrics = [
    {
      label: 'System Health',
      value: 98,
      icon: Activity,
      color: 'text-green-500',
    },
    {
      label: 'API Response Time',
      value: 85,
      description: '245ms avg',
      icon: Zap,
      color: 'text-blue-500',
    },
    {
      label: 'Database Performance',
      value: 92,
      icon: Database,
      color: 'text-purple-500',
    },
    {
      label: 'Order Processing Rate',
      value: 94,
      description: '156 orders/hour',
      icon: TrendingUp,
      color: 'text-orange-500',
    },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Activity className="h-5 w-5" />
          System Performance
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {metrics.map((metric) => {
            const Icon = metric.icon;
            return (
              <div key={metric.label} className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Icon className={`h-4 w-4 ${metric.color}`} />
                    <span className="text-sm font-medium">{metric.label}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-sm font-bold">{metric.value}%</span>
                    {metric.description && (
                      <p className="text-xs text-muted-foreground">{metric.description}</p>
                    )}
                  </div>
                </div>
                <Progress value={metric.value} className="h-2" />
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
};
