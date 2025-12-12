import { useState, useEffect, useCallback, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Notification } from '@/utils/notificationHelpers';
import { useAuth } from '@/contexts/AuthContext';
import { debounce } from '@/utils/performanceOptimizations';

export const useNotifications = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [unreadCount, setUnreadCount] = useState(0);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  // Fetch notifications
  const { data: notifications, isLoading } = useQuery<Notification[]>({
    queryKey: ['notifications', user?.id],
    queryFn: async () => {
      if (!user) return [];

      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      return data as Notification[];
    },
    enabled: !!user,
    refetchInterval: 120000, // Reduced from 30s to 2 minutes
  });

  // Update unread count
  useEffect(() => {
    if (notifications) {
      const count = notifications.filter((n) => !n.read).length;
      setUnreadCount(count);
    }
  }, [notifications]);

  // Debounced invalidation to prevent cascade refetches
  const debouncedInvalidate = useCallback(
    debounce(() => {
      if (user) {
        queryClient.invalidateQueries({ queryKey: ['notifications', user.id] });
      }
    }, 500),
    [user, queryClient]
  );

  // Set up real-time subscription with stable reference
  useEffect(() => {
    if (!user) {
      // Clean up existing channel if user logs out
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
      return;
    }

    // Only set up channel if it doesn't exist
    if (channelRef.current) return;

    console.log('Setting up notifications real-time subscription');

    const channel = supabase
      .channel('notifications-changes')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          debouncedInvalidate();
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          debouncedInvalidate();
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          debouncedInvalidate();
        }
      )
      .subscribe();

    channelRef.current = channel;

    return () => {
      console.log('Cleaning up notifications subscription');
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [user?.id, debouncedInvalidate]);

  return {
    notifications: notifications || [],
    unreadCount,
    isLoading,
  };
};
