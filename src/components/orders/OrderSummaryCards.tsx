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
    },
    { 
      title: 'Booked', 
      value: summaryData.booked, 
      status: 'booked',
      icon: Clock,
    },
    { 
      title: 'Dispatched', 
      value: summaryData.dispatched, 
      status: 'dispatched',
      icon: Truck,
    },
    { 
      title: 'Delivered', 
      value: summaryData.delivered, 
      status: 'delivered',
      icon: CheckCircle,
    },
    { 
      title: 'Cancelled', 
      value: summaryData.cancelled, 
      status: 'cancelled',
      icon: XCircle,
    },
    { 
      title: 'Returns', 
      value: summaryData.returns, 
      status: 'returned',
      icon: RotateCcw,
    },
  ], [totalCount, summaryData]);

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
      {summaryCards.map((card) => {
        const Icon = card.icon;
        return (
          <button
            key={card.status}
            onClick={() => onStatusFilter?.(card.status)}
            className="flex flex-col items-start gap-1 p-4 rounded-lg bg-card border border-border hover:border-primary/30 hover:shadow-sm transition-all text-left"
          >
            <div className="flex items-center gap-2 text-muted-foreground">
              <Icon className="h-4 w-4" />
              <span className="text-sm font-medium">{card.title}</span>
            </div>
            <span className="text-2xl font-bold text-foreground">
              {card.value.toLocaleString()}
            </span>
          </button>
        );
      })}
    </div>
  );
});

OrderSummaryCards.displayName = 'OrderSummaryCards';