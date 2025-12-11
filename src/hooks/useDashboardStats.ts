import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface DashboardStats {
  order_counts: Record<string, number>;
  total_orders: number;
  total_revenue: number;
  total_customers: number;
  pending_count: number;
  dispatched_today: number;
}

export function useDashboardStats(startDate?: Date, endDate?: Date) {
  return useQuery({
    queryKey: ['dashboard-stats', startDate?.toISOString(), endDate?.toISOString()],
    queryFn: async (): Promise<DashboardStats> => {
      const { data, error } = await supabase.rpc('get_dashboard_stats', {
        p_start_date: startDate?.toISOString() || null,
        p_end_date: endDate?.toISOString() || null,
      });

      if (error) throw error;
      
      return data as unknown as DashboardStats;
    },
    staleTime: 30000, // 30 seconds
    gcTime: 5 * 60 * 1000, // 5 minutes
  });
}

export function useOrderCountsByStatus() {
  return useQuery({
    queryKey: ['order-counts-by-status'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_order_counts_by_status_optimized');

      if (error) throw error;
      
      return data as Array<{ status: string; count: number; today_count: number }>;
    },
    staleTime: 30000,
    gcTime: 5 * 60 * 1000,
  });
}
