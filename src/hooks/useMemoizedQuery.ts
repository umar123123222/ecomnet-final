import { useQuery, UseQueryOptions, QueryKey } from '@tanstack/react-query';
import { useMemo } from 'react';

/**
 * Optimized version of useQuery that includes:
 * - Longer stale times to reduce refetches
 * - Disabled refetch on mount by default
 * - Memoized query results
 * 
 * Use this for stable data that doesn't change frequently
 */
export function useMemoizedQuery<T>(
  queryKey: QueryKey,
  queryFn: () => Promise<T>,
  options?: Omit<UseQueryOptions<T>, 'queryKey' | 'queryFn'>
) {
  const query = useQuery<T>({
    queryKey,
    queryFn,
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    ...options,
  });

  // Memoize the data to prevent unnecessary re-renders
  const memoizedData = useMemo(() => query.data, [query.data]);

  return {
    ...query,
    data: memoizedData,
  };
}
