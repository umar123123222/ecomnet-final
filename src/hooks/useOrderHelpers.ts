import { useCallback, useMemo } from 'react';

// Optimized status color mapping - memoized lookup
const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
  confirmed: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  booked: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400',
  dispatched: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-400',
  delivered: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  cancelled: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
  returned: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400',
};

const DEFAULT_COLOR = 'bg-muted text-muted-foreground';

export function useOrderHelpers() {
  // Memoized status color getter
  const getStatusColor = useCallback((status: string): string => {
    return STATUS_COLORS[status] || DEFAULT_COLOR;
  }, []);

  // Format currency
  const formatCurrency = useCallback((amount: number): string => {
    return `PKR ${amount.toLocaleString()}`;
  }, []);

  // Format date
  const formatDate = useCallback((date: string | Date): string => {
    const d = new Date(date);
    return d.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  }, []);

  // Format datetime
  const formatDateTime = useCallback((date: string | Date): string => {
    const d = new Date(date);
    return d.toLocaleString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }, []);

  // Get status date field for filtering
  const getStatusDateField = useCallback((status: string): string => {
    switch (status) {
      case 'pending':
        return 'created_at';
      case 'booked':
        return 'booked_at';
      case 'dispatched':
        return 'dispatched_at';
      case 'delivered':
        return 'delivered_at';
      case 'returned':
      case 'cancelled':
        return 'updated_at';
      default:
        return 'created_at';
    }
  }, []);

  return {
    getStatusColor,
    formatCurrency,
    formatDate,
    formatDateTime,
    getStatusDateField,
  };
}

// Hook for managing order selection with Set (O(1) operations)
export function useOrderSelection() {
  const toggleSelection = useCallback(
    (selectedSet: Set<string>, id: string, checked: boolean): Set<string> => {
      const newSet = new Set(selectedSet);
      if (checked) {
        newSet.add(id);
      } else {
        newSet.delete(id);
      }
      return newSet;
    },
    []
  );

  const selectAll = useCallback(
    (orders: Array<{ id: string }>): Set<string> => {
      return new Set(orders.map((o) => o.id));
    },
    []
  );

  const clearSelection = useCallback((): Set<string> => {
    return new Set();
  }, []);

  const isAllSelected = useCallback(
    (selectedSet: Set<string>, orders: Array<{ id: string }>): boolean => {
      return orders.length > 0 && orders.every((o) => selectedSet.has(o.id));
    },
    []
  );

  return {
    toggleSelection,
    selectAll,
    clearSelection,
    isAllSelected,
  };
}
