import React, { memo, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

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
}

export const OrderSummaryCards = memo(({ totalCount, summaryData }: OrderSummaryCardsProps) => {
  const summaryCards = useMemo(() => [
    { title: 'Total Orders', value: totalCount.toLocaleString(), color: 'bg-blue-500' },
    { title: 'Booked', value: summaryData.booked.toLocaleString(), color: 'bg-orange-500' },
    { title: 'Dispatched', value: summaryData.dispatched.toLocaleString(), color: 'bg-purple-500' },
    { title: 'Delivered', value: summaryData.delivered.toLocaleString(), color: 'bg-green-500' },
    { title: 'Cancelled', value: summaryData.cancelled.toLocaleString(), color: 'bg-red-500' },
    { title: 'Returns', value: summaryData.returns.toLocaleString(), color: 'bg-gray-500' },
  ], [totalCount, summaryData]);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
      {summaryCards.map((card, index) => (
        <Card key={index}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">
              {card.title}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{card.value}</div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
});

OrderSummaryCards.displayName = 'OrderSummaryCards';
