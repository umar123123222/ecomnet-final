/**
 * UI Constants - Colors, Chart Colors, Status Styles
 */

// Chart Colors (using CSS variables)
export const CHART_COLORS = {
  PRIMARY: 'hsl(var(--chart-1))',
  SECONDARY: 'hsl(var(--chart-2))',
  TERTIARY: 'hsl(var(--chart-3))',
  QUATERNARY: 'hsl(var(--chart-4))',
  QUINARY: 'hsl(var(--chart-5))',
} as const;

// Status Colors for Order Badges
export const ORDER_STATUS_COLORS: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
  confirmed: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  booked: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400',
  dispatched: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-400',
  delivered: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  cancelled: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
  returned: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400',
};

export const DEFAULT_STATUS_COLOR = 'bg-muted text-muted-foreground';

// Risk Level Colors
export const RISK_LEVEL_COLORS = {
  low: 'text-green-600',
  medium: 'text-amber-600',
  high: 'text-orange-600',
  critical: 'text-red-600',
} as const;

// Priority Badge Variants
export const PRIORITY_VARIANTS = {
  low: 'secondary',
  medium: 'default',
  high: 'warning',
  critical: 'destructive',
} as const;
