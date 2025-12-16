import React, { memo } from 'react';
import { TableBody, TableCell, TableRow } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ChevronDown, ChevronUp, Package, Shield } from 'lucide-react';
import { OrderStatusBadge } from './OrderStatusBadge';
import { OrderExpandedRow } from './OrderExpandedRow';
import { OrderAlertIndicators } from './OrderAlertIndicators';
import { QuickActionButtons } from './QuickActionButtons';
import { InlineCourierAssign } from './InlineCourierAssign';
import type { FormattedOrder } from '@/hooks/useOrdersData';

// Wrapper to avoid passing attributes directly to React.Fragment
const Noop: React.FC<{ children: React.ReactNode }> = ({ children }) => <>{children}</>;

interface OrderTableBodyProps {
  orders: FormattedOrder[];
  loading: boolean;
  selectedOrders: Set<string>;
  expandedRows: Set<string>;
  couriers: any[];
  primaryRole: string | null;
  canUpdateStatus: boolean;
  canOverrideDispatchLock: boolean;
  canAssignCouriers: boolean;
  onSelectOrder: (orderId: string) => void;
  onToggleExpand: (orderId: string) => void;
  onStatusChange: (orderId: string, newStatus: string) => void;
  onMarkDispatched: (orderId: string) => void;
  onGenerateLabel: (orderId: string) => void;
  onViewActivity: (orderId: string) => void;
  onCourierAssigned: () => void;
}

export const OrderTableBody = memo(({
  orders,
  loading,
  selectedOrders,
  expandedRows,
  couriers,
  primaryRole,
  canUpdateStatus,
  canOverrideDispatchLock,
  canAssignCouriers,
  onSelectOrder,
  onToggleExpand,
  onStatusChange,
  onMarkDispatched,
  onGenerateLabel,
  onViewActivity,
  onCourierAssigned
}: OrderTableBodyProps) => {
  if (loading) {
    return (
      <TableBody>
        <TableRow>
          <TableCell colSpan={9} className="text-center py-12">
            <div className="flex flex-col items-center gap-2">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              <span className="text-sm text-muted-foreground">Loading orders...</span>
            </div>
          </TableCell>
        </TableRow>
      </TableBody>
    );
  }

  if (orders.length === 0) {
    return (
      <TableBody>
        <TableRow>
          <TableCell colSpan={9} className="text-center py-12">
            <div className="flex flex-col items-center gap-2">
              <Package className="h-12 w-12 text-muted-foreground/50" />
              <span className="text-sm text-muted-foreground">No orders found</span>
            </div>
          </TableCell>
        </TableRow>
      </TableBody>
    );
  }

  return (
    <TableBody>
      {orders.map(order => (
        <Noop key={order.id}>
          <TableRow className="hover:bg-muted/50">
            <TableCell>
              <Checkbox
                checked={selectedOrders.has(order.id)}
                onCheckedChange={() => onSelectOrder(order.id)}
              />
            </TableCell>

            <TableCell className="font-mono text-sm font-medium">
              <div className="flex items-center gap-2">
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-2">
                    <span>{(order.orderNumber || String(order.shopify_order_id || '') || order.id.slice(0, 8)).replace(/^SHOP-/, '')}</span>
                  </div>
                  {order.fraudIndicators?.isHighRisk && (
                    <Badge variant="destructive" className="gap-1 w-fit text-xs">
                      <Shield className="h-3 w-3" />
                      Risk: {order.fraudIndicators.riskScore}%
                    </Badge>
                  )}
                </div>
                <OrderAlertIndicators order={order} />
              </div>
            </TableCell>

            <TableCell>
              <span className="text-sm">{order.customer}</span>
            </TableCell>

            <TableCell>
              <span className="text-sm font-mono">{order.phone}</span>
            </TableCell>

            <TableCell>
              <span className="text-sm font-semibold">{order.amount}</span>
            </TableCell>

            <TableCell>
              <div className="flex flex-col gap-1.5">
                <OrderStatusBadge
                  status={order.status}
                  orderId={order.id}
                  primaryRole={primaryRole}
                  canUpdateStatus={canUpdateStatus}
                  canOverrideDispatchLock={canOverrideDispatchLock}
                  onStatusChange={onStatusChange}
                />
                {order.status === 'dispatched' && order.courier && order.courier !== 'N/A' && (
                  <span className="text-xs text-muted-foreground">
                    Via {order.courier.toUpperCase()}
                  </span>
                )}
              </div>
            </TableCell>

            <TableCell>
              {canAssignCouriers ? (
                <InlineCourierAssign
                  orderId={order.id}
                  currentCourier={order.courier}
                  trackingId={order.trackingId}
                  couriers={couriers}
                  orderDetails={{
                    orderNumber: order.orderNumber,
                    customer: order.customer,
                    phone: order.phone,
                    address: order.address,
                    city: order.city,
                    items: order.items,
                    totalPrice: order.totalPrice
                  }}
                  onAssigned={onCourierAssigned}
                />
              ) : (
                <span className="text-sm text-muted-foreground">
                  {order.courier !== 'N/A' ? order.courier : 'Not assigned'}
                </span>
              )}
            </TableCell>

            <TableCell>
              <QuickActionButtons
                orderId={order.id}
                orderStatus={order.status}
                onMarkDispatched={onMarkDispatched}
                onGenerateLabel={onGenerateLabel}
                onViewActivity={onViewActivity}
              />
            </TableCell>

            <TableCell>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onToggleExpand(order.id)}
                className="h-8 w-8 p-0"
              >
                {expandedRows.has(order.id) ? (
                  <ChevronUp className="h-4 w-4" />
                ) : (
                  <ChevronDown className="h-4 w-4" />
                )}
              </Button>
            </TableCell>
          </TableRow>

          {expandedRows.has(order.id) && <OrderExpandedRow order={order} />}
        </Noop>
      ))}
    </TableBody>
  );
});

OrderTableBody.displayName = 'OrderTableBody';
