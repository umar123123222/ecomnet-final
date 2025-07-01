
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

    // Try to get from users table
    let { data: userProfile } = await supabase
      .from('users')
      .select('*')
      .eq('id', user.id)
      .single();

    if (userProfile) {
      return {
        id: userProfile.id,
        name: userProfile.name,
        email: userProfile.email,
        phone: userProfile.phone,
        role: userProfile.role,
        status: userProfile.status,
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
      .from('users')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;

    return (data || []).map(user => ({
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      role: user.role,
      status: user.status,
      created_at: user.created_at,
      updated_at: user.updated_at,
    }));
  },

  async updateUser(id: string, updates: Partial<User>): Promise<User> {
    const { data, error } = await supabase
      .from('users')
      .update({
        name: updates.name,
        email: updates.email,
        phone: updates.phone,
        role: updates.role,
        status: updates.status,
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    return {
      id: data.id,
      name: data.name,
      email: data.email,
      phone: data.phone,
      role: data.role,
      status: data.status,
      created_at: data.created_at,
      updated_at: data.updated_at,
    };
  }
};
