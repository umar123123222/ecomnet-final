import { useState, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface PaginationState {
  page: number;
  pageSize: number;
}

interface UsePaginatedQueryOptions<T> {
  queryKey: string[];
  tableName: string;
  select?: string;
  filters?: Record<string, any>;
  orderBy?: { column: string; ascending?: boolean };
  pageSize?: number;
}

interface PaginatedResult<T> {
  data: T[];
  isLoading: boolean;
  error: Error | null;
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
  nextPage: () => void;
  prevPage: () => void;
  goToPage: (page: number) => void;
  setPageSize: (size: number) => void;
  refetch: () => void;
}

export function usePaginatedQuery<T>({
  queryKey,
  tableName,
  select = '*',
  filters = {},
  orderBy = { column: 'created_at', ascending: false },
  pageSize: initialPageSize = 50,
}: UsePaginatedQueryOptions<T>): PaginatedResult<T> {
  const [pagination, setPagination] = useState<PaginationState>({
    page: 0,
    pageSize: initialPageSize,
  });

  const { page, pageSize } = pagination;
  const from = page * pageSize;
  const to = from + pageSize - 1;

  // Count query
  const { data: countData } = useQuery({
    queryKey: [...queryKey, 'count', filters],
    queryFn: async () => {
      let query = supabase
        .from(tableName as any)
        .select('*', { count: 'exact', head: true });

      // Apply filters
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          if (Array.isArray(value)) {
            query = query.in(key, value);
          } else {
            query = query.eq(key, value);
          }
        }
      });

      const { count, error } = await query;
      if (error) throw error;
      return count || 0;
    },
    staleTime: 60000,
  });

  // Data query
  const {
    data,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: [...queryKey, page, pageSize, filters, orderBy],
    queryFn: async () => {
      let query = supabase
        .from(tableName as any)
        .select(select)
        .range(from, to)
        .order(orderBy.column, { ascending: orderBy.ascending ?? false });

      // Apply filters
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          if (Array.isArray(value)) {
            query = query.in(key, value);
          } else {
            query = query.eq(key, value);
          }
        }
      });

      const { data, error } = await query;
      if (error) throw error;
      return data as T[];
    },
    staleTime: 30000,
  });

  const totalCount = countData || 0;
  const totalPages = Math.ceil(totalCount / pageSize);

  const nextPage = useCallback(() => {
    setPagination((prev) => ({
      ...prev,
      page: Math.min(prev.page + 1, totalPages - 1),
    }));
  }, [totalPages]);

  const prevPage = useCallback(() => {
    setPagination((prev) => ({
      ...prev,
      page: Math.max(prev.page - 1, 0),
    }));
  }, []);

  const goToPage = useCallback((newPage: number) => {
    setPagination((prev) => ({
      ...prev,
      page: Math.max(0, Math.min(newPage, totalPages - 1)),
    }));
  }, [totalPages]);

  const setPageSize = useCallback((size: number) => {
    setPagination({ page: 0, pageSize: size });
  }, []);

  return {
    data: data || [],
    isLoading,
    error: error as Error | null,
    page,
    pageSize,
    totalCount,
    totalPages,
    hasNextPage: page < totalPages - 1,
    hasPrevPage: page > 0,
    nextPage,
    prevPage,
    goToPage,
    setPageSize,
    refetch,
  };
}
