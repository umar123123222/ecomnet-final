import React, { memo, useMemo } from 'react';
import { Package, Truck, CheckCircle, XCircle, RotateCcw, Clock } from 'lucide-react';

interface SummaryData {
  totalOrders: number;
  booked: number;
  dispatched: number;
  delivered: number;
  cancelled: number;
  returns: number;
}

interface OrderSummaryCardsProps {
  totalCount: number;
  summaryData: SummaryData;
  onStatusFilter?: (status: string) => void;
}

export const OrderSummaryCards = memo(({ totalCount, summaryData, onStatusFilter }: OrderSummaryCardsProps) => {
  const summaryCards = useMemo(() => [
    { 
      title: 'Total', 
      value: totalCount, 
      status: 'all',
      icon: Package,
      color: 'text-primary',
      bgColor: 'bg-primary/10',
    },
    { 
      title: 'Booked', 
      value: summaryData.booked, 
      status: 'booked',
      icon: Clock,
      color: 'text-orange-600',
      bgColor: 'bg-orange-500/10',
    },
    { 
      title: 'Dispatched', 
      value: summaryData.dispatched, 
      status: 'dispatched',
      icon: Truck,
      color: 'text-purple-600',
      bgColor: 'bg-purple-500/10',
    },
    { 
      title: 'Delivered', 
      value: summaryData.delivered, 
      status: 'delivered',
      icon: CheckCircle,
      color: 'text-green-600',
      bgColor: 'bg-green-500/10',
    },
    { 
      title: 'Cancelled', 
      value: summaryData.cancelled, 
      status: 'cancelled',
      icon: XCircle,
      color: 'text-red-600',
      bgColor: 'bg-red-500/10',
    },
    { 
      title: 'Returns', 
      value: summaryData.returns, 
      status: 'returned',
      icon: RotateCcw,
      color: 'text-muted-foreground',
      bgColor: 'bg-muted',
    },
  ], [totalCount, summaryData]);

  return (
    <div className="flex flex-wrap gap-2">
      {summaryCards.map((card) => {
        const Icon = card.icon;
        return (
          <button
            key={card.status}
            onClick={() => onStatusFilter?.(card.status)}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg border border-border/50 hover:border-border hover:bg-muted/50 transition-colors ${card.bgColor}`}
          >
            <Icon className={`h-4 w-4 ${card.color}`} />
            <span className="text-xs font-medium text-muted-foreground">{card.title}</span>
            <span className={`text-sm font-bold ${card.color}`}>
              {card.value.toLocaleString()}
            </span>
          </button>
        );
      })}
    </div>
  );
});

OrderSummaryCards.displayName = 'OrderSummaryCards';