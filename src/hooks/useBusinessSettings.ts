import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useCallback } from "react";
import { useToast } from "@/hooks/use-toast";

export interface BusinessSetting {
  setting_key: string;
  setting_value: string;
  description?: string;
}

export const useBusinessSettings = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Fetch all business settings
  const { data: settings = [], isLoading } = useQuery({
    queryKey: ['business-settings'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('api_settings')
        .select('*')
        .order('setting_key');
      
      if (error) throw error;
      return data as BusinessSetting[];
    },
  });

  // Real-time subscription to api_settings changes (silent refresh - no toast spam)
  useEffect(() => {
    const channel = supabase
      .channel('business-settings-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'api_settings'
        },
        (payload) => {
          console.log('Business settings changed:', payload);
          
          // Silently invalidate and refetch settings - no toast to avoid spam
          queryClient.invalidateQueries({ queryKey: ['business-settings'] });
          queryClient.invalidateQueries({ queryKey: ['company-currency'] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  // Mutation to update a setting
  const updateSettingMutation = useMutation({
    mutationFn: async ({ key, value, description }: { key: string; value: string; description?: string }) => {
      const user = await supabase.auth.getUser();
      
      const { error } = await supabase
        .from('api_settings')
        .upsert({
          setting_key: key,
          setting_value: value,
          description: description,
          updated_by: user.data.user?.id,
        }, {
          onConflict: 'setting_key'
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['business-settings'] });
      queryClient.invalidateQueries({ queryKey: ['company-currency'] });
    },
  });

  // Helper function to get a specific setting
  const getSetting = useCallback((key: string): string | undefined => {
    return settings.find(s => s.setting_key === key)?.setting_value;
  }, [settings]);

  // Helper function to update a setting
  const updateSetting = useCallback(async (key: string, value: string, description?: string) => {
    try {
      await updateSettingMutation.mutateAsync({ key, value, description });
      return true;
    } catch (error) {
      console.error('Failed to update setting:', error);
      return false;
    }
  }, [updateSettingMutation]);

  return {
    settings,
    isLoading,
    getSetting,
    updateSetting,
    isUpdating: updateSettingMutation.isPending,
  };
};
