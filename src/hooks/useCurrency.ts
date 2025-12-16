import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const useCurrency = () => {
  const { data: currency = 'PKR', isLoading } = useQuery({
    queryKey: ['company-currency'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('api_settings')
        .select('setting_value')
        .eq('setting_key', 'company_currency')
        .single();
      
      if (error) {
        console.log('Currency not set, using default PKR');
        return 'PKR';
      }
      
      return data?.setting_value || 'PKR';
    },
  });

  return { currency, isLoading };
};
