import React, { memo, useCallback } from 'react';
import { TableCell, TableRow } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ChevronDown, ChevronUp, Eye, AlertTriangle } from 'lucide-react';

interface Order {
  id: string;
  orderNumber: string;
  customer: string;
  phone: string;
  city: string;
  amount: string;
  status: string;
  courier: string;
  trackingId: string;
  date: string;
  gptScore?: number;
  tags?: string[];
}

interface OrderTableRowProps {
  order: Order;
  isSelected: boolean;
  isExpanded: boolean;
  onSelect: (id: string, checked: boolean) => void;
  onToggleExpand: (id: string) => void;
  onViewDetails: (order: Order) => void;
  getStatusColor: (status: string) => string;
}

// Memoized row component - only re-renders when its specific props change
export const OrderTableRow = memo(({
  order,
  isSelected,
  isExpanded,
  onSelect,
  onToggleExpand,
  onViewDetails,
  getStatusColor,
}: OrderTableRowProps) => {
  const handleCheckboxChange = useCallback((checked: boolean) => {
    onSelect(order.id, checked);
  }, [order.id, onSelect]);

  const handleToggleExpand = useCallback(() => {
    onToggleExpand(order.id);
  }, [order.id, onToggleExpand]);

  const handleViewDetails = useCallback(() => {
    onViewDetails(order);
  }, [order, onViewDetails]);

  return (
    <TableRow className={isSelected ? 'bg-primary/5' : ''}>
      <TableCell>
        <Checkbox
          checked={isSelected}
          onCheckedChange={handleCheckboxChange}
        />
      </TableCell>
      <TableCell>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleToggleExpand}
          className="p-1 h-6 w-6"
        >
          {isExpanded ? (
            <ChevronUp className="h-4 w-4" />
          ) : (
            <ChevronDown className="h-4 w-4" />
          )}
        </Button>
      </TableCell>
      <TableCell className="font-medium">
        <div className="flex items-center gap-2">
          {order.orderNumber}
          {order.gptScore && order.gptScore > 50 && (
            <AlertTriangle className="h-4 w-4 text-amber-500" />
          )}
        </div>
      </TableCell>
      <TableCell>
        <div className="max-w-[150px] truncate" title={order.customer}>
          {order.customer}
        </div>
      </TableCell>
      <TableCell className="hidden md:table-cell">{order.phone}</TableCell>
      <TableCell className="hidden lg:table-cell">{order.city}</TableCell>
      <TableCell>{order.amount}</TableCell>
      <TableCell>
        <Badge className={getStatusColor(order.status)}>
          {order.status}
        </Badge>
      </TableCell>
      <TableCell className="hidden md:table-cell">
        {order.courier !== 'N/A' ? (
          <Badge variant="outline">{order.courier}</Badge>
        ) : (
          <span className="text-muted-foreground text-sm">-</span>
        )}
      </TableCell>
      <TableCell className="hidden lg:table-cell">
        {order.trackingId !== 'N/A' ? (
          <span className="font-mono text-xs">{order.trackingId}</span>
        ) : (
          <span className="text-muted-foreground text-sm">-</span>
        )}
      </TableCell>
      <TableCell className="hidden xl:table-cell text-muted-foreground text-sm">
        {order.date}
      </TableCell>
      <TableCell>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleViewDetails}
          className="h-8 px-2"
        >
          <Eye className="h-4 w-4" />
        </Button>
      </TableCell>
    </TableRow>
  );
}, (prevProps, nextProps) => {
  // Custom comparison for better memoization
  return (
    prevProps.order.id === nextProps.order.id &&
    prevProps.isSelected === nextProps.isSelected &&
    prevProps.isExpanded === nextProps.isExpanded &&
    prevProps.order.status === nextProps.order.status &&
    prevProps.order.courier === nextProps.order.courier &&
    prevProps.order.trackingId === nextProps.order.trackingId
  );
});

OrderTableRow.displayName = 'OrderTableRow';
