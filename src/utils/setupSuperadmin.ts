import { supabase } from '@/integrations/supabase/client';

export const setupSuperadmin = async (email: string, password: string, fullName?: string) => {
  const { data, error } = await supabase.functions.invoke('setup-superadmin', {
    body: { email, password, full_name: fullName },
  });

  if (error) throw error;
  return data;
};
