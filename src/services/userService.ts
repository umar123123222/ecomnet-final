
import { supabase } from '@/integrations/supabase/client';

export interface User {
  id: string;
  name: string;
  email: string;
  phone?: string;
  role: string;
  status: string;
  created_at: string;
  updated_at: string;
}

export const userService = {
  async getCurrentUser(): Promise<User | null> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    // Try to get from profiles table first, then users table
    let { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    if (profile) {
      return {
        id: profile.id,
        name: profile.full_name,
        email: profile.email,
        role: profile.role,
        status: profile.is_active ? 'active' : 'inactive',
        created_at: profile.created_at,
        updated_at: profile.updated_at,
      };
    }

    // Fallback to creating a basic user object
    return {
      id: user.id,
      name: user.email?.split('@')[0] || 'Unknown User',
      email: user.email || '',
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

    return (data || []).map(profile => ({
      id: profile.id,
      name: profile.full_name,
      email: profile.email,
      role: profile.role,
      status: profile.is_active ? 'active' : 'inactive',
      created_at: profile.created_at,
      updated_at: profile.updated_at,
    }));
  },

  async updateUser(id: string, updates: Partial<User>): Promise<User> {
    const { data, error } = await supabase
      .from('profiles')
      .update({
        full_name: updates.name,
        email: updates.email,
        role: updates.role,
        is_active: updates.status === 'active',
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    return {
      id: data.id,
      name: data.full_name,
      email: data.email,
      role: data.role,
      status: data.is_active ? 'active' : 'inactive',
      created_at: data.created_at,
      updated_at: data.updated_at,
    };
  }
};
