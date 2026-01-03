import { useCallback } from 'react';
import { ORDER_STATUS_COLORS, DEFAULT_STATUS_COLOR } from '@/constants/ui';
import { ORDER_STATUS_DATE_FIELDS } from '@/constants/statuses';
import { formatCurrency as formatCurrencyUtil } from '@/utils/currency';
import { useCurrency } from '@/hooks/useCurrency';
import { DEFAULT_LOCALE, DATE_LOCALE_OPTIONS } from '@/constants/locale';

export function useOrderHelpers() {
  const { currency } = useCurrency();

  // Memoized status color getter
  const getStatusColor = useCallback((status: string): string => {
    return ORDER_STATUS_COLORS[status] || DEFAULT_STATUS_COLOR;
  }, []);

  // Format currency using system currency
  const formatCurrency = useCallback((amount: number): string => {
    return formatCurrencyUtil(amount, currency);
  }, [currency]);

  // Format date using system locale
  const formatDate = useCallback((date: string | Date): string => {
    const d = new Date(date);
    const locale = DATE_LOCALE_OPTIONS[DEFAULT_LOCALE as keyof typeof DATE_LOCALE_OPTIONS] || 'en-GB';
    return d.toLocaleDateString(locale, {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  }, []);

  // Format datetime using system locale
  const formatDateTime = useCallback((date: string | Date): string => {
    const d = new Date(date);
    const locale = DATE_LOCALE_OPTIONS[DEFAULT_LOCALE as keyof typeof DATE_LOCALE_OPTIONS] || 'en-GB';
    return d.toLocaleString(locale, {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }, []);

  // Get status date field for filtering
  const getStatusDateField = useCallback((status: string): string => {
    return ORDER_STATUS_DATE_FIELDS[status as keyof typeof ORDER_STATUS_DATE_FIELDS] || 'created_at';
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
