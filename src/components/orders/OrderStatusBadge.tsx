import React, { memo } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Clock, CheckCircle, Package, Truck, X, Lock } from 'lucide-react';

interface OrderStatusBadgeProps {
  status: string;
  orderId: string;
  primaryRole: string | null;
  canUpdateStatus: boolean;
  canOverrideDispatchLock: boolean;
  onStatusChange: (orderId: string, newStatus: string) => void;
}

const statusMap: Record<string, { variant: any; label: string; icon?: any }> = {
  'pending': { variant: 'warning', label: 'Pending', icon: Clock },
  'confirmed': { variant: 'default', label: 'Confirmed', icon: CheckCircle },
  'booked': { variant: 'info', label: 'Booked', icon: Package },
  'dispatched': { variant: 'processing', label: 'Dispatched', icon: Truck },
  'delivered': { variant: 'success', label: 'Delivered', icon: CheckCircle },
  'returned': { variant: 'destructive', label: 'Returned', icon: Package },
  'cancelled': { variant: 'destructive', label: 'Cancelled', icon: X }
};

const allStatuses = [
  { value: 'pending', label: 'Pending' },
  { value: 'confirmed', label: 'Confirmed' },
  { value: 'booked', label: 'Booked' },
  { value: 'dispatched', label: 'Dispatched' },
  { value: 'delivered', label: 'Delivered' },
  { value: 'returned', label: 'Returned' },
  { value: 'cancelled', label: 'Cancelled' }
];

export const OrderStatusBadge = memo(({
  status,
  orderId,
  primaryRole,
  canUpdateStatus,
  canOverrideDispatchLock,
  onStatusChange
}: OrderStatusBadgeProps) => {
  const statusInfo = statusMap[status] || statusMap.pending;
  const StatusIcon = statusInfo.icon;

  const allowedStatuses = primaryRole === 'staff'
    ? allStatuses.filter(s => ['pending', 'confirmed', 'cancelled'].includes(s.value))
    : allStatuses;

  // If order is dispatched, show locked badge for users without override permission
  if (status === 'dispatched' && !canOverrideDispatchLock) {
    return (
      <Badge variant={statusInfo.variant} className="gap-1.5">
        {StatusIcon && <StatusIcon className="h-3.5 w-3.5" />}
        {statusInfo.label}
        <Lock className="h-3 w-3 ml-1" />
      </Badge>
    );
  }

  // If user can't update, just show the badge without dropdown
  if (!canUpdateStatus) {
    return (
      <Badge variant={statusInfo.variant} className="gap-1.5">
        {StatusIcon && <StatusIcon className="h-3.5 w-3.5" />}
        {statusInfo.label}
      </Badge>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="h-auto p-0 hover:bg-transparent">
          <Badge variant={statusInfo.variant} className="gap-1.5 cursor-pointer hover:opacity-80">
            {StatusIcon && <StatusIcon className="h-3.5 w-3.5" />}
            {statusInfo.label}
          </Badge>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="bg-background">
        {allowedStatuses.map(statusOption => (
          <DropdownMenuItem
            key={statusOption.value}
            onClick={() => onStatusChange(orderId, statusOption.value)}
            className={status === statusOption.value ? 'bg-muted' : ''}
          >
            {statusOption.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
});

OrderStatusBadge.displayName = 'OrderStatusBadge';
