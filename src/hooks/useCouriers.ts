import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface Courier {
  id: string;
  name: string;
  code: string;
}

/**
 * Shared hook for fetching couriers with React Query caching
 * Prevents duplicate network requests across components
 */
export const useCouriers = () => {
  return useQuery({
    queryKey: ['couriers', 'active'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('couriers')
        .select('id, name, code')
        .eq('is_active', true)
        .order('name');
      
      if (error) throw error;
      return (data || []) as Courier[];
    },
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
    gcTime: 10 * 60 * 1000, // Keep in cache for 10 minutes
  });
};
