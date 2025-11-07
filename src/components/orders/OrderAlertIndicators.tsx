import React from 'react';
import { MapPin, AlertCircle, Shield, Clock } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface OrderAlertIndicatorsProps {
  order: {
    address?: string;
    orderType?: string;
    createdAtISO?: string;
    status?: string;
    fraudIndicators?: {
      riskLevel?: string;
      flags?: string[];
    };
  };
}

export const OrderAlertIndicators: React.FC<OrderAlertIndicatorsProps> = ({ order }) => {
  const alerts: Array<{ icon: React.ReactNode; message: string; color: string }> = [];

  // Check for missing address
  if (!order.address || order.address.length < 10) {
    alerts.push({
      icon: <MapPin className="h-4 w-4" />,
      message: 'Address information incomplete or missing',
      color: 'text-destructive',
    });
  }

  // Check for payment confirmation (COD orders are always considered confirmed)
  if (order.orderType !== 'COD' && order.status === 'pending') {
    alerts.push({
      icon: <AlertCircle className="h-4 w-4" />,
      message: 'Payment not confirmed',
      color: 'text-amber-500',
    });
  }

  // Check for fraud risk
  if (order.fraudIndicators?.riskLevel === 'high' || order.fraudIndicators?.riskLevel === 'critical') {
    alerts.push({
      icon: <Shield className="h-4 w-4" />,
      message: `Customer flagged: ${order.fraudIndicators.flags?.join(', ') || 'High risk'}`,
      color: 'text-destructive',
    });
  }

  // Check for orders pending more than 24 hours
  if (order.status === 'pending' && order.createdAtISO) {
    const hoursSinceCreated = (Date.now() - new Date(order.createdAtISO).getTime()) / (1000 * 60 * 60);
    if (hoursSinceCreated > 24) {
      alerts.push({
        icon: <Clock className="h-4 w-4" />,
        message: `Order pending for ${Math.floor(hoursSinceCreated)} hours`,
        color: 'text-amber-500',
      });
    }
  }

  if (alerts.length === 0) return null;

  return (
    <TooltipProvider>
      <div className="flex items-center gap-1">
        {alerts.map((alert, index) => (
          <Tooltip key={index}>
            <TooltipTrigger asChild>
              <div className={`${alert.color} cursor-help`}>
                {alert.icon}
              </div>
            </TooltipTrigger>
            <TooltipContent>
              <p>{alert.message}</p>
            </TooltipContent>
          </Tooltip>
        ))}
      </div>
    </TooltipProvider>
  );
};