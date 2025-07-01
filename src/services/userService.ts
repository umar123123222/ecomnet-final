
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
  async getUsers() {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data as User[];
  },

  async getCurrentUser() {
    const { data: authUser } = await supabase.auth.getUser();
    if (!authUser.user) return null;

    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('email', authUser.user.email)
      .single();

    if (error) throw error;
    return data as User;
  },

  async createUser(user: Omit<User, 'id' | 'created_at' | 'updated_at'>) {
    const { data, error } = await supabase
      .from('users')
      .insert(user)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async updateUser(id: string, updates: Partial<User>) {
    const { data, error } = await supabase
      .from('users')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async deleteUser(id: string) {
    const { error } = await supabase
      .from('users')
      .delete()
      .eq('id', id);

    if (error) throw error;
  }
};
