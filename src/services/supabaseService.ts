
import { supabase } from '@/integrations/supabase/client';
import { Customer, Order, Return, Profile, ActivityLog, UserPerformance, OrderItem } from '@/types/database';

// Helper function to parse JSON items safely
const parseOrderItems = (items: any): OrderItem[] => {
  try {
    if (typeof items === 'string') {
      return JSON.parse(items);
    }
    if (Array.isArray(items)) {
      return items;
    }
    return [];
  } catch {
    return [];
  }
};

// Customer Service
export const customerService = {
  async getAll(): Promise<Customer[]> {
    const { data, error } = await supabase
      .from('customers')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    return (data || []) as Customer[];
  },

  async getSuspicious(): Promise<Customer[]> {
    const { data, error } = await supabase
      .from('customers')
      .select('*')
      .eq('is_suspicious', true)
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    return (data || []) as Customer[];
  },

  async create(customer: Omit<Customer, 'id' | 'created_at' | 'updated_at'>): Promise<Customer> {
    const { data, error } = await supabase
      .from('customers')
      .insert(customer)
      .select()
      .single();
    
    if (error) throw error;
    return data as Customer;
  },

  async update(id: string, updates: Partial<Customer>): Promise<Customer> {
    const { data, error } = await supabase
      .from('customers')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    
    if (error) throw error;
    return data as Customer;
  },

  async delete(id: string): Promise<void> {
    const { error } = await supabase
      .from('customers')
      .delete()
      .eq('id', id);
    
    if (error) throw error;
  }
};

// Order Service
export const orderService = {
  async getAll(): Promise<Order[]> {
    const { data, error } = await supabase
      .from('orders')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    return (data || []).map((order: any) => ({
      ...order,
      items: parseOrderItems(order.items)
    })) as Order[];
  },

  async getByStatus(status: Order['status']): Promise<Order[]> {
    const { data, error } = await supabase
      .from('orders')
      .select('*')
      .eq('status', status)
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    return (data || []).map((order: any) => ({
      ...order,
      items: parseOrderItems(order.items)
    })) as Order[];
  },

  async getForVerification(): Promise<Order[]> {
    const { data, error } = await supabase
      .from('orders')
      .select('*')
      .eq('verification_status', 'pending')
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    return (data || []).map((order: any) => ({
      ...order,
      items: parseOrderItems(order.items)
    })) as Order[];
  },

  async create(order: Omit<Order, 'id' | 'created_at' | 'updated_at'>): Promise<Order> {
    const { data, error } = await supabase
      .from('orders')
      .insert({
        ...order,
        items: JSON.stringify(order.items)
      })
      .select()
      .single();
    
    if (error) throw error;
    return {
      ...data,
      items: parseOrderItems(data.items)
    } as Order;
  },

  async update(id: string, updates: Partial<Order>): Promise<Order> {
    const updateData = { ...updates };
    if (updateData.items) {
      (updateData as any).items = JSON.stringify(updateData.items);
    }

    const { data, error } = await supabase
      .from('orders')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();
    
    if (error) throw error;
    return {
      ...data,
      items: parseOrderItems(data.items)
    } as Order;
  },

  async updateVerificationStatus(
    id: string, 
    status: 'approved' | 'disapproved', 
    notes?: string,
    verifiedBy?: string
  ): Promise<Order> {
    const { data, error } = await supabase
      .from('orders')
      .update({
        verification_status: status,
        verification_notes: notes,
        verified_by: verifiedBy,
        verified_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();
    
    if (error) throw error;
    return {
      ...data,
      items: parseOrderItems(data.items)
    } as Order;
  }
};

// Return Service
export const returnService = {
  async getAll(): Promise<Return[]> {
    const { data, error } = await supabase
      .from('returns')
      .select(`
        *,
        order:orders(*)
      `)
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    return (data || []).map((returnItem: any) => ({
      ...returnItem,
      order: returnItem.order ? {
        ...returnItem.order,
        items: parseOrderItems(returnItem.order.items)
      } : undefined
    })) as Return[];
  },

  async create(returnData: Omit<Return, 'id' | 'created_at' | 'updated_at'>): Promise<Return> {
    const { data, error } = await supabase
      .from('returns')
      .insert(returnData)
      .select()
      .single();
    
    if (error) throw error;
    return data as Return;
  },

  async update(id: string, updates: Partial<Return>): Promise<Return> {
    const { data, error } = await supabase
      .from('returns')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    
    if (error) throw error;
    return data as Return;
  }
};

// Profile Service
export const profileService = {
  async getAll(): Promise<Profile[]> {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    return (data || []) as Profile[];
  },

  async getCurrent(): Promise<Profile | null> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();
    
    if (error) throw error;
    return data as Profile;
  },

  async update(id: string, updates: Partial<Profile>): Promise<Profile> {
    const { data, error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    
    if (error) throw error;
    return data as Profile;
  }
};

// Activity Log Service
export const activityLogService = {
  async create(log: Omit<ActivityLog, 'id' | 'created_at'>): Promise<void> {
    const { error } = await supabase
      .from('activity_logs')
      .insert(log);
    
    if (error) throw error;
  },

  async getRecent(limit = 50): Promise<ActivityLog[]> {
    const { data, error } = await supabase
      .from('activity_logs')
      .select(`
        *,
        profiles(full_name)
      `)
      .order('created_at', { ascending: false })
      .limit(limit);
    
    if (error) throw error;
    return (data || []) as ActivityLog[];
  }
};

// User Performance Service
export const performanceService = {
  async getByUser(userId: string, days = 30): Promise<UserPerformance[]> {
    const { data, error } = await supabase
      .from('user_performance')
      .select('*')
      .eq('user_id', userId)
      .gte('date', new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().split('T')[0])
      .order('date', { ascending: false });
    
    if (error) throw error;
    return (data || []) as UserPerformance[];
  },

  async updateDaily(userId: string, updates: Partial<Pick<UserPerformance, 'orders_processed' | 'returns_handled' | 'addresses_verified'>>): Promise<void> {
    const today = new Date().toISOString().split('T')[0];
    
    const { error } = await supabase
      .from('user_performance')
      .upsert({
        user_id: userId,
        date: today,
        ...updates
      });
    
    if (error) throw error;
  }
};

// Dashboard Service
export const dashboardService = {
  async getStats() {
    const [
      { count: totalOrders },
      { count: pendingOrders },
      { count: totalCustomers },
      { count: suspiciousCustomers },
      { count: totalReturns }
    ] = await Promise.all([
      supabase.from('orders').select('*', { count: 'exact', head: true }),
      supabase.from('orders').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
      supabase.from('customers').select('*', { count: 'exact', head: true }),
      supabase.from('customers').select('*', { count: 'exact', head: true }).eq('is_suspicious', true),
      supabase.from('returns').select('*', { count: 'exact', head: true })
    ]);

    return {
      totalOrders: totalOrders || 0,
      pendingOrders: pendingOrders || 0,
      totalCustomers: totalCustomers || 0,
      suspiciousCustomers: suspiciousCustomers || 0,
      totalReturns: totalReturns || 0
    };
  }
};
