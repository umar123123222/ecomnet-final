import { useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface UseOrdersRealtimeOptions {
  onOrderChange?: () => void;
  enabled?: boolean;
}

/**
 * Hook to subscribe to real-time order status changes
 * Replaces polling for order status updates
 */
export const useOrdersRealtime = ({ 
  onOrderChange, 
  enabled = true 
}: UseOrdersRealtimeOptions = {}) => {
  const handleChange = useCallback(() => {
    onOrderChange?.();
  }, [onOrderChange]);

  useEffect(() => {
    if (!enabled) return;

    const channel = supabase
      .channel('orders-realtime')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'orders'
        },
        (payload) => {
          console.log('Order updated via realtime:', payload.new?.order_number);
          handleChange();
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'orders'
        },
        (payload) => {
          console.log('New order via realtime:', payload.new?.order_number);
          handleChange();
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log('Subscribed to orders realtime channel');
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [enabled, handleChange]);
};
