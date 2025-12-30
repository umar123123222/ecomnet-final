import { useQuery, UseQueryOptions, QueryKey } from '@tanstack/react-query';
import { useCallback, useRef, useState, useEffect } from 'react';

// Optimized query hook with deduplication and caching
export function useOptimizedQuery<TData, TError = Error>(
  queryKey: QueryKey,
  queryFn: () => Promise<TData>,
  options?: Omit<UseQueryOptions<TData, TError, TData, QueryKey>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey,
    queryFn,
    staleTime: 5 * 60 * 1000, // 5 minutes default
    gcTime: 10 * 60 * 1000, // 10 minutes garbage collection
    refetchOnWindowFocus: false,
    retry: 1,
    ...options,
  });
}

// Debounced search hook
export function useDebouncedValue<T>(value: T, delay: number = 300): T {
  const [debouncedValue, setDebouncedValue] = useState(value);
  const timerRef = useRef<NodeJS.Timeout>();

  useEffect(() => {
    timerRef.current = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [value, delay]);

  return debouncedValue;
}

// Intersection observer hook for lazy loading
export function useIntersectionObserver(
  ref: React.RefObject<Element>,
  options?: IntersectionObserverInit
) {
  const [isIntersecting, setIsIntersecting] = useState(false);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const observer = new IntersectionObserver(([entry]) => {
      setIsIntersecting(entry.isIntersecting);
    }, options);

    observer.observe(element);

    return () => {
      observer.disconnect();
    };
  }, [ref, options]);

  return isIntersecting;
}

// Stable callback hook to prevent unnecessary re-renders
export function useStableCallback<T extends (...args: any[]) => any>(callback: T): T {
  const callbackRef = useRef(callback);
  callbackRef.current = callback;

  return useCallback((...args: Parameters<T>) => {
    return callbackRef.current(...args);
  }, []) as T;
}

// Batch update hook for multiple state changes
export function useBatchedUpdates() {
  const updates = useRef<(() => void)[]>([]);
  const scheduled = useRef(false);

  const scheduleUpdate = useCallback((update: () => void) => {
    updates.current.push(update);
    
    if (!scheduled.current) {
      scheduled.current = true;
      requestAnimationFrame(() => {
        const batch = updates.current;
        updates.current = [];
        scheduled.current = false;
        batch.forEach(fn => fn());
      });
    }
  }, []);

  return scheduleUpdate;
}

// Previous value hook for comparison
export function usePrevious<T>(value: T): T | undefined {
  const ref = useRef<T>();
  useEffect(() => {
    ref.current = value;
  }, [value]);
  return ref.current;
}
