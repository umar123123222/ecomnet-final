/**
 * Business Thresholds and Timeouts
 */

// Fraud Detection Thresholds
export const FRAUD_THRESHOLDS = {
  HIGH_VALUE_ORDER: 50000,
  NEW_CUSTOMER_HIGH_VALUE: 30000,
  RAPID_ORDER_COUNT: 3,
  RAPID_ORDER_HOURS: 24,
  MAX_ADDRESSES_NORMAL: 4,
  HIGH_RETURN_RATE_PERCENT: 50,
  MIN_ORDERS_FOR_RETURN_CHECK: 3,
  MIN_ADDRESSES_SUSPICIOUS: 5,
  RISK_SCORE_BLOCK: 80,
  RISK_SCORE_FLAG: 60,
  RISK_SCORE_MONITOR: 40,
  MIN_FAILED_DELIVERIES_FLAG: 2,
} as const;

// Timeouts (in milliseconds)
export const TIMEOUTS = {
  AUTH_LOADING: 30000, // 30 seconds max auth loading
  SCANNER_MODE_RESET: 300000, // 5 minutes
  DEBOUNCE_SEARCH: 300,
  DEBOUNCE_INPUT: 500,
  TOAST_DURATION: 5000,
  SESSION_CHECK: 60000, // 1 minute
} as const;

// Refetch Intervals (in milliseconds)
export const REFETCH_INTERVALS = {
  NOTIFICATIONS: 60000, // 1 minute
  REAL_TIME_DATA: 30000, // 30 seconds
  INVENTORY: 300000, // 5 minutes
  DASHBOARD_STATS: 300000, // 5 minutes
  SYNC_STATUS: 10000, // 10 seconds during sync
} as const;

// Stock Level Thresholds
export const STOCK_THRESHOLDS = {
  DEFAULT_REORDER_LEVEL: 10,
  LOW_STOCK_DAYS: 7,
  OVERSTOCK_MULTIPLIER: 5,
  AGING_WARNING_DAYS: 90,
  AGING_CRITICAL_DAYS: 180,
} as const;

// Order Processing Thresholds
export const ORDER_THRESHOLDS = {
  STUCK_ORDER_HOURS: 48,
  UNVERIFIED_ORDER_DAYS: 7,
  RETURN_OVERDUE_DAYS: 14,
} as const;
