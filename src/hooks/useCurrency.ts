import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const useCurrency = () => {
  const { data: currency = 'USD', isLoading } = useQuery({
    queryKey: ['company-currency'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('api_settings')
        .select('setting_value')
        .eq('setting_key', 'company_currency')
        .single();
      
      if (error) {
        console.log('Currency not set, using default USD');
        return 'USD';
      }
      
      return data?.setting_value || 'USD';
    },
  });

  return { currency, isLoading };
};
