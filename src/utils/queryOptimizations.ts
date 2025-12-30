import { supabase } from '@/integrations/supabase/client';

// Batch fetch utility for reducing N+1 queries
export async function batchFetch<T, K extends string | number>(
  ids: K[],
  fetcher: (ids: K[]) => Promise<T[]>,
  batchSize: number = 50
): Promise<T[]> {
  if (ids.length === 0) return [];
  
  const uniqueIds = [...new Set(ids)];
  const results: T[] = [];
  
  for (let i = 0; i < uniqueIds.length; i += batchSize) {
    const batch = uniqueIds.slice(i, i + batchSize);
    const batchResults = await fetcher(batch);
    results.push(...batchResults);
  }
  
  return results;
}

// Optimized order count query using database function
export async function getOrderCountsByStatus() {
  const { data, error } = await supabase.rpc('get_order_stats_by_status');
  
  if (error) {
    console.error('Error fetching order stats:', error);
    return null;
  }
  
  return data?.reduce((acc, item) => {
    acc[item.status] = item.count;
    return acc;
  }, {} as Record<string, number>);
}

// Lightweight count query using direct SQL
export async function getTableCount(
  table: string,
  filters?: Record<string, any>
): Promise<number> {
  // Use a simple count approach
  const { count, error } = await supabase
    .from('orders')
    .select('id', { count: 'exact', head: true });
  
  if (error) throw error;
  
  return count || 0;
}

// Cached query results with TTL
const queryResultsCache = new Map<string, { data: any; timestamp: number }>();
const CACHE_TTL = 60 * 1000; // 1 minute

export function getCachedResult<T>(key: string): T | null {
  const cached = queryResultsCache.get(key);
  if (!cached) return null;
  
  if (Date.now() - cached.timestamp > CACHE_TTL) {
    queryResultsCache.delete(key);
    return null;
  }
  
  return cached.data as T;
}

export function setCachedResult<T>(key: string, data: T): void {
  queryResultsCache.set(key, { data, timestamp: Date.now() });
}

export function invalidateCache(pattern?: string): void {
  if (!pattern) {
    queryResultsCache.clear();
    return;
  }
  
  const regex = new RegExp(pattern);
  queryResultsCache.forEach((_, key) => {
    if (regex.test(key)) {
      queryResultsCache.delete(key);
    }
  });
}

// Parallel query executor with concurrency limit
export async function parallelQueries<T>(
  queries: (() => Promise<T>)[],
  concurrency: number = 5
): Promise<T[]> {
  const results: T[] = [];
  
  for (let i = 0; i < queries.length; i += concurrency) {
    const batch = queries.slice(i, i + concurrency);
    const batchResults = await Promise.all(batch.map(q => q()));
    results.push(...batchResults);
  }
  
  return results;
}

// Select only needed columns to reduce payload size
export function selectColumns<T extends string>(columns: T[]): string {
  return columns.join(', ');
}

// Optimized search query builder
export function buildSearchQuery(
  searchTerm: string,
  fields: string[]
): string {
  if (!searchTerm) return '';
  
  const sanitized = searchTerm.replace(/[%_]/g, '\\$&');
  return fields.map(field => `${field}.ilike.%${sanitized}%`).join(',');
}
