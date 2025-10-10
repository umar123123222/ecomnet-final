// Simple in-memory cache for query results with TTL
import * as React from 'react';

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

class QueryCache {
  private static instance: QueryCache;
  private cache: Map<string, CacheEntry<any>>;
  private readonly DEFAULT_TTL = 5 * 60 * 1000; // 5 minutes

  private constructor() {
    this.cache = new Map();
    // Clean expired entries every minute
    setInterval(() => this.cleanExpired(), 60 * 1000);
  }

  public static getInstance(): QueryCache {
    if (!QueryCache.instance) {
      QueryCache.instance = new QueryCache();
    }
    return QueryCache.instance;
  }

  // Set a cache entry with optional TTL
  public set<T>(key: string, data: T, ttl: number = this.DEFAULT_TTL): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl,
    });
  }

  // Get a cache entry if it exists and hasn't expired
  public get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    
    if (!entry) {
      return null;
    }

    const now = Date.now();
    const isExpired = now - entry.timestamp > entry.ttl;

    if (isExpired) {
      this.cache.delete(key);
      return null;
    }

    return entry.data as T;
  }

  // Check if a key exists and is valid
  public has(key: string): boolean {
    return this.get(key) !== null;
  }

  // Remove a specific cache entry
  public delete(key: string): boolean {
    return this.cache.delete(key);
  }

  // Clear all cache entries
  public clear(): void {
    this.cache.clear();
  }

  // Clean expired entries
  private cleanExpired(): void {
    const now = Date.now();
    const keysToDelete: string[] = [];

    this.cache.forEach((entry, key) => {
      if (now - entry.timestamp > entry.ttl) {
        keysToDelete.push(key);
      }
    });

    keysToDelete.forEach(key => this.cache.delete(key));
    
    if (keysToDelete.length > 0) {
      console.log(`Cleaned ${keysToDelete.length} expired cache entries`);
    }
  }

  // Get cache statistics
  public getStats(): { size: number; keys: string[] } {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys()),
    };
  }

  // Invalidate all entries matching a pattern
  public invalidatePattern(pattern: string): number {
    let count = 0;
    const regex = new RegExp(pattern);
    
    this.cache.forEach((_, key) => {
      if (regex.test(key)) {
        this.cache.delete(key);
        count++;
      }
    });

    return count;
  }
}

export const queryCache = QueryCache.getInstance();

// React hook for cached queries
export function useCachedQuery<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttl?: number
): {
  data: T | null;
  isLoading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
} {
  const [data, setData] = React.useState<T | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<Error | null>(null);

  const fetchData = React.useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Check cache first
      const cached = queryCache.get<T>(key);
      if (cached !== null) {
        setData(cached);
        setIsLoading(false);
        return;
      }

      // Fetch fresh data
      const result = await fetcher();
      queryCache.set(key, result, ttl);
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Unknown error'));
    } finally {
      setIsLoading(false);
    }
  }, [key, fetcher, ttl]);

  React.useEffect(() => {
    fetchData();
  }, [fetchData]);

  return {
    data,
    isLoading,
    error,
    refetch: fetchData,
  };
}