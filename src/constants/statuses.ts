/**
 * Order and System Status Constants
 */

// Order Statuses
export const ORDER_STATUSES = {
  PENDING: 'pending',
  CONFIRMED: 'confirmed',
  BOOKED: 'booked',
  DISPATCHED: 'dispatched',
  DELIVERED: 'delivered',
  CANCELLED: 'cancelled',
  RETURNED: 'returned',
} as const;

export type OrderStatus = typeof ORDER_STATUSES[keyof typeof ORDER_STATUSES];

export const ORDER_STATUS_LIST: OrderStatus[] = [
  ORDER_STATUSES.PENDING,
  ORDER_STATUSES.CONFIRMED,
  ORDER_STATUSES.BOOKED,
  ORDER_STATUSES.DISPATCHED,
  ORDER_STATUSES.DELIVERED,
  ORDER_STATUSES.CANCELLED,
  ORDER_STATUSES.RETURNED,
];

// Status labels for display
export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  [ORDER_STATUSES.PENDING]: 'Pending',
  [ORDER_STATUSES.CONFIRMED]: 'Confirmed',
  [ORDER_STATUSES.BOOKED]: 'Booked',
  [ORDER_STATUSES.DISPATCHED]: 'Dispatched',
  [ORDER_STATUSES.DELIVERED]: 'Delivered',
  [ORDER_STATUSES.CANCELLED]: 'Cancelled',
  [ORDER_STATUSES.RETURNED]: 'Returned',
};

// Status date fields for filtering
export const ORDER_STATUS_DATE_FIELDS: Record<OrderStatus, string> = {
  [ORDER_STATUSES.PENDING]: 'created_at',
  [ORDER_STATUSES.CONFIRMED]: 'created_at',
  [ORDER_STATUSES.BOOKED]: 'booked_at',
  [ORDER_STATUSES.DISPATCHED]: 'dispatched_at',
  [ORDER_STATUSES.DELIVERED]: 'delivered_at',
  [ORDER_STATUSES.CANCELLED]: 'updated_at',
  [ORDER_STATUSES.RETURNED]: 'updated_at',
};

// Payment Statuses
export const PAYMENT_STATUSES = {
  PENDING: 'pending',
  PAID: 'paid',
  PARTIAL: 'partial',
  REFUNDED: 'refunded',
} as const;

export type PaymentStatus = typeof PAYMENT_STATUSES[keyof typeof PAYMENT_STATUSES];

// Purchase Order Statuses
export const PO_STATUSES = {
  PENDING: 'pending',
  SENT: 'sent',
  CONFIRMED: 'confirmed',
  SHIPPED: 'shipped',
  RECEIVED: 'received',
  PARTIALLY_RECEIVED: 'partially_received',
  CANCELLED: 'cancelled',
} as const;

export type POStatus = typeof PO_STATUSES[keyof typeof PO_STATUSES];

// Stock Transfer Statuses
export const TRANSFER_STATUSES = {
  PENDING: 'pending',
  APPROVED: 'approved',
  IN_TRANSIT: 'in_transit',
  RECEIVED: 'received',
  REJECTED: 'rejected',
  CANCELLED: 'cancelled',
} as const;

export type TransferStatus = typeof TRANSFER_STATUSES[keyof typeof TRANSFER_STATUSES];

// Stock Adjustment Types
export const ADJUSTMENT_TYPES = {
  ADDITION: 'addition',
  REDUCTION: 'reduction',
  CORRECTION: 'correction',
  DAMAGE: 'damage',
  RETURN: 'return',
} as const;

export type AdjustmentType = typeof ADJUSTMENT_TYPES[keyof typeof ADJUSTMENT_TYPES];

// Return Statuses
export const RETURN_STATUSES = {
  PENDING: 'pending',
  RECEIVED: 'received',
  INSPECTED: 'inspected',
  RESTOCKED: 'restocked',
  CLAIMED: 'claimed',
} as const;

export type ReturnStatus = typeof RETURN_STATUSES[keyof typeof RETURN_STATUSES];
