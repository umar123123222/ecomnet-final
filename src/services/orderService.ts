
import { supabase } from '@/integrations/supabase/client';

export interface Order {
  id: string;
  customer_id: string;
  order_type: string;
  gpt_score: number;
  status: 'pending' | 'booked' | 'dispatched' | 'delivered' | 'cancelled' | 'returned';
  price: number;
  city: string;
  courier: 'postex' | 'leopard' | 'tcs' | 'other';
  shipping_address: string;
  tracking_id?: string;
  notes?: string;
  tags?: string[];
  assigned_to?: string;
  created_at: string;
  updated_at: string;
  dispatched_at?: string;
  delivered_at?: string;
  customer?: {
    id: string;
    name: string;
    email?: string;
    phone?: string;
  };
  order_items?: {
    id: string;
    item_name: string;
    quantity: number;
    price: number;
  }[];
  assigned_user?: {
    id: string;
    name: string;
  };
}

export const orderService = {
  async getOrders(filters?: {
    status?: string;
    courier?: string;
    search?: string;
    limit?: number;
    offset?: number;
  }) {
    let query = supabase
      .from('orders')
      .select(`
        *,
        customer:customers(*),
        assigned_user:profiles!orders_assigned_to_fkey(id, full_name)
      `)
      .order('created_at', { ascending: false });

    if (filters?.status && filters.status !== 'all') {
      query = query.eq('status', filters.status as any);
    }

    if (filters?.courier && filters.courier !== 'all') {
      query = query.eq('courier', filters.courier as any);
    }

    if (filters?.search) {
      query = query.or(`tracking_id.ilike.%${filters.search}%`);
    }

    if (filters?.limit) {
      query = query.limit(filters.limit);
    }

    if (filters?.offset) {
      query = query.range(filters.offset, filters.offset + (filters.limit || 10) - 1);
    }

    const { data, error } = await query;

    if (error) throw error;
    
    return (data || []).map(order => ({
      id: order.id,
      customer_id: order.customer_id,
      order_type: 'regular', // Default since column doesn't exist
      gpt_score: 0, // Default since column doesn't exist
      status: order.status,
      price: Number(order.total_amount) || 0,
      city: 'Unknown', // Default since column doesn't exist in schema
      courier: order.courier,
      shipping_address: order.shipping_address,
      tracking_id: order.tracking_id,
      notes: order.notes,
      tags: order.tags,
      assigned_to: order.assigned_to,
      created_at: order.created_at,
      updated_at: order.updated_at,
      dispatched_at: order.dispatched_at,
      delivered_at: order.delivered_at,
      customer: order.customer,
      order_items: Array.isArray(order.items) ? order.items : [],
      assigned_user: order.assigned_user ? {
        id: order.assigned_user.id,
        name: order.assigned_user.full_name
      } : undefined
    })) as Order[];
  },

  async updateOrder(id: string, updates: Partial<Order>) {
    const dbUpdates: any = { ...updates };
    if (updates.price) dbUpdates.total_amount = updates.price;
    
    const { data, error } = await supabase
      .from('orders')
      .update(dbUpdates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async bulkUpdateOrders(orderIds: string[], updates: Partial<Order>) {
    const dbUpdates: any = { ...updates };
    if (updates.price) dbUpdates.total_amount = updates.price;
    
    const { data, error } = await supabase
      .from('orders')
      .update(dbUpdates)
      .in('id', orderIds)
      .select();

    if (error) throw error;
    return data;
  },

  async getOrderStats() {
    const { data, error } = await supabase
      .from('orders')
      .select('status, courier, created_at');

    if (error) throw error;

    const stats = {
      total: data.length,
      booked: data.filter(o => o.status === 'booked').length,
      dispatched: data.filter(o => o.status === 'dispatched').length,
      delivered: data.filter(o => o.status === 'delivered').length,
      cancelled: data.filter(o => o.status === 'cancelled').length,
      returned: data.filter(o => o.status === 'returned').length,
    };

    return stats;
  },

  async addTag(orderId: string, tag: string, userId: string) {
    const { data: order } = await supabase
      .from('orders')
      .select('tags')
      .eq('id', orderId)
      .single();

    const currentTags = order?.tags || [];
    const newTags = [...currentTags, tag];

    const { data, error } = await supabase
      .from('orders')
      .update({ tags: newTags })
      .eq('id', orderId)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async removeTag(orderId: string, tagIndex: number) {
    const { data: order } = await supabase
      .from('orders')
      .select('tags')
      .eq('id', orderId)
      .single();

    const currentTags = order?.tags || [];
    const newTags = currentTags.filter((_, index) => index !== tagIndex);

    const { data, error } = await supabase
      .from('orders')
      .update({ tags: newTags })
      .eq('id', orderId)
      .select()
      .single();

    if (error) throw error;
    return data;
  }
};
