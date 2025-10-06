import { supabase } from './client';

export interface ManageUserRequest {
  action: 'create' | 'update' | 'delete';
  userData: {
    userId?: string;
    email: string;
    full_name?: string;
    password?: string;
    roles: string[];
  };
}

export const manageUser = async (request: ManageUserRequest) => {
  const { data, error } = await supabase.functions.invoke('manage-user', {
    body: request,
  });

  if (error) throw error;
  return data;
};
