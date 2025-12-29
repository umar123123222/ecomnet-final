import React, { memo, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Clock, CheckCircle, Package, Truck, X, Lock } from 'lucide-react';
import { DeliveredDateDialog } from './DeliveredDateDialog';

interface OrderStatusBadgeProps {
  status: string;
  orderId: string;
  orderNumber?: string;
  primaryRole: string | null;
  canUpdateStatus: boolean;
  canOverrideDispatchLock: boolean;
  canSetDeliveredWithDate?: boolean;
  onStatusChange: (orderId: string, newStatus: string, additionalData?: Record<string, any>) => void;
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
  orderNumber = '',
  primaryRole,
  canUpdateStatus,
  canOverrideDispatchLock,
  canSetDeliveredWithDate = false,
  onStatusChange
}: OrderStatusBadgeProps) => {
  const [showDeliveredDialog, setShowDeliveredDialog] = useState(false);
  const statusInfo = statusMap[status] || statusMap.pending;
  const StatusIcon = statusInfo.icon;

  // Determine allowed statuses based on role
  const getAllowedStatuses = () => {
    if (primaryRole === 'staff') {
      // Staff can only set: pending, confirmed, cancelled (NOT delivered)
      return allStatuses.filter(s => ['pending', 'confirmed', 'cancelled'].includes(s.value));
    }
    if (primaryRole === 'senior_staff') {
      // Senior staff can set: pending, confirmed, cancelled, delivered (with date picker)
      return allStatuses.filter(s => ['pending', 'confirmed', 'cancelled', 'delivered'].includes(s.value));
    }
    // All other roles with update permission get all statuses
    return allStatuses;
  };

  const allowedStatuses = getAllowedStatuses();

  const handleStatusClick = (newStatus: string) => {
    // If selecting 'delivered' and user has permission to set with date
    if (newStatus === 'delivered' && canSetDeliveredWithDate) {
      setShowDeliveredDialog(true);
      return;
    }
    onStatusChange(orderId, newStatus);
  };

  const handleDeliveredConfirm = (deliveredAt: Date) => {
    onStatusChange(orderId, 'delivered', { delivered_at: deliveredAt.toISOString() });
  };

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
    <>
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
              onClick={() => handleStatusClick(statusOption.value)}
              className={status === statusOption.value ? 'bg-muted' : ''}
            >
              {statusOption.label}
              {statusOption.value === 'delivered' && canSetDeliveredWithDate && (
                <span className="ml-2 text-xs text-muted-foreground">(select date)</span>
              )}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      <DeliveredDateDialog
        open={showDeliveredDialog}
        onOpenChange={setShowDeliveredDialog}
        orderNumber={orderNumber}
        onConfirm={handleDeliveredConfirm}
      />
    </>
  );
});

OrderStatusBadge.displayName = 'OrderStatusBadge';
