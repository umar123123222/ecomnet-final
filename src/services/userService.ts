
import { supabase } from '@/integrations/supabase/client';

export interface User {
  id: string;
  name: string;
  email: string;
  phone?: string;
  role: 'Owner/SuperAdmin' | 'Store Manager' | 'Dispatch Manager' | 'Returns Manager' | 'Staff';
  status: string;
  created_at: string;
  updated_at: string;
}

export const userService = {
  async getCurrentUser(): Promise<User | null> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    // Try to get from profiles table
    let { data: userProfile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    if (userProfile) {
      return {
        id: userProfile.id,
        name: userProfile.full_name,
        email: userProfile.email,
        phone: '',
        role: userProfile.role === 'admin' ? 'Owner/SuperAdmin' : 
              userProfile.role === 'dispatch' ? 'Dispatch Manager' : 'Staff',
        status: userProfile.is_active ? 'active' : 'inactive',
        created_at: userProfile.created_at,
        updated_at: userProfile.updated_at,
      };
    }

    // Fallback to creating a basic user object
    return {
      id: user.id,
      name: user.email?.split('@')[0] || 'Unknown User',
      email: user.email || '',
      phone: '',
      role: 'Staff',
      status: 'active',
      created_at: user.created_at || new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
  },

  async getUsers(): Promise<User[]> {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;

    return (data || []).map(user => ({
      id: user.id,
      name: user.full_name,
      email: user.email,
      phone: '',
      role: user.role === 'admin' ? 'Owner/SuperAdmin' : 
            user.role === 'dispatch' ? 'Dispatch Manager' : 'Staff',
      status: user.is_active ? 'active' : 'inactive',
      created_at: user.created_at,
      updated_at: user.updated_at,
    }));
  },

  async updateUser(id: string, updates: Partial<User>): Promise<User> {
    const dbUpdates: any = {};
    
    if (updates.name) dbUpdates.full_name = updates.name;
    if (updates.email) dbUpdates.email = updates.email;
    if (updates.status) dbUpdates.is_active = updates.status === 'active';
    if (updates.role) {
      dbUpdates.role = updates.role === 'Owner/SuperAdmin' ? 'admin' :
                      updates.role === 'Dispatch Manager' ? 'dispatch' : 'order_handler';
    }

    const { data, error } = await supabase
      .from('profiles')
      .update(dbUpdates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    return {
      id: data.id,
      name: data.full_name,
      email: data.email,
      phone: '',
      role: data.role === 'admin' ? 'Owner/SuperAdmin' : 
            data.role === 'dispatch' ? 'Dispatch Manager' : 'Staff',
      status: data.is_active ? 'active' : 'inactive',
      created_at: data.created_at,
      updated_at: data.updated_at,
    };
  }
};
