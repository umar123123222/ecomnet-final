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
    <div className="flex flex-wrap gap-2">
      {summaryCards.map((card) => {
        const Icon = card.icon;
        return (
          <button
            key={card.status}
            onClick={() => onStatusFilter?.(card.status)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-md border border-border bg-background hover:bg-muted/50 transition-colors text-sm"
          >
            <Icon className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-muted-foreground">{card.title}</span>
            <span className="font-semibold text-foreground">
              {card.value.toLocaleString()}
            </span>
          </button>
        );
      })}
    </div>
  );
});

OrderSummaryCards.displayName = 'OrderSummaryCards';