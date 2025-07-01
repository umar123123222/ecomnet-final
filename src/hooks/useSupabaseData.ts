
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export function useSupabaseData<T>(
  table: string,
  selectQuery = '*',
  filters?: Record<string, any>,
  orderBy?: { column: string; ascending?: boolean }
) {
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function fetchData() {
      try {
        setLoading(true);
        setError(null);

        let query = supabase.from(table as any).select(selectQuery);

        // Apply filters
        if (filters) {
          Object.entries(filters).forEach(([key, value]) => {
            query = query.eq(key, value);
          });
        }

        // Apply ordering
        if (orderBy) {
          query = query.order(orderBy.column, { ascending: orderBy.ascending ?? false });
        }

        const { data: result, error: queryError } = await query;

        if (queryError) throw queryError;

        if (isMounted) {
          setData((result as T[]) || []);
        }
      } catch (err) {
        if (isMounted) {
          setError(err instanceof Error ? err.message : 'An error occurred');
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    fetchData();

    return () => {
      isMounted = false;
    };
  }, [table, selectQuery, JSON.stringify(filters), JSON.stringify(orderBy)]);

  const refetch = () => {
    setLoading(true);
    // The useEffect will handle the refetch
  };

  return { data, loading, error, refetch };
}

export function useRealtimeData<T>(
  table: string,
  selectQuery = '*',
  filters?: Record<string, any>
) {
  const { data, loading, error, refetch } = useSupabaseData<T>(table, selectQuery, filters);

  useEffect(() => {
    const channel = supabase
      .channel(`${table}-changes`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: table
        },
        () => {
          refetch();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [table, refetch]);

  return { data, loading, error, refetch };
}
