
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export const useSupabaseQuery = <T>(
  queryKey: string[],
  queryFn: () => Promise<T>,
  options?: {
    enabled?: boolean;
    staleTime?: number;
  }
) => {
  return useQuery({
    queryKey,
    queryFn,
    staleTime: options?.staleTime || 5 * 60 * 1000, // 5 minutes
    enabled: options?.enabled,
  });
};

export const useSupabaseMutation = <T, V>(
  mutationFn: (variables: V) => Promise<T>,
  options?: {
    onSuccess?: (data: T) => void;
    onError?: (error: Error) => void;
    invalidateKeys?: string[][];
  }
) => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn,
    onSuccess: (data) => {
      options?.onSuccess?.(data);
      options?.invalidateKeys?.forEach(key => {
        queryClient.invalidateQueries({ queryKey: key });
      });
    },
    onError: (error: Error) => {
      console.error('Mutation error:', error);
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
      options?.onError?.(error);
    },
  });
};
