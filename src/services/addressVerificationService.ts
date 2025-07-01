
import { supabase } from '@/integrations/supabase/client';

export interface AddressVerificationData {
  id: string;
  order_id: string;
  gpt_score: number;
  flagged_reason?: string;
  verified: boolean;
  verified_by?: string;
  verified_at?: string;
  created_at: string;
  order?: {
    id: string;
    customer_id: string;
    shipping_address: string;
    tracking_id?: string;
    customer?: {
      name: string;
      phone?: string;
    };
  };
  verifier?: {
    name: string;
  };
}

export const addressVerificationService = {
  async getAddressVerifications(filters?: {
    verified?: boolean;
    search?: string;
  }): Promise<AddressVerificationData[]> {
    // Since address_verifications table doesn't exist in current schema,
    // we'll use the existing orders table and simulate address verification data
    let query = supabase
      .from('orders')
      .select(`
        id,
        customer_id,
        shipping_address,
        tracking_id,
        created_at,
        customer:customers(name, phone)
      `)
      .order('created_at', { ascending: false });

    if (filters?.search) {
      query = query.or(`tracking_id.ilike.%${filters.search}%`);
    }

    const { data, error } = await query;

    if (error) throw error;

    // Transform orders data to match AddressVerification interface
    return (data || []).map(order => ({
      id: order.id,
      order_id: order.id,
      gpt_score: Math.floor(Math.random() * 100), // Simulated GPT score
      verified: false,
      created_at: order.created_at,
      order: {
        id: order.id,
        customer_id: order.customer_id,
        shipping_address: order.shipping_address,
        tracking_id: order.tracking_id,
        customer: order.customer
      }
    }));
  },

  async approveAddress(id: string, userId: string) {
    // For now, we'll just return success since the table doesn't exist
    return { id, verified: true, verified_by: userId, verified_at: new Date().toISOString() };
  },

  async disapproveAddress(id: string, userId: string) {
    // For now, we'll just return success since the table doesn't exist
    return { id, verified: false, verified_by: userId, verified_at: new Date().toISOString() };
  },

  async bulkApprove(ids: string[], userId: string) {
    // For now, we'll just return success since the table doesn't exist
    return ids.map(id => ({ id, verified: true, verified_by: userId, verified_at: new Date().toISOString() }));
  },

  async bulkDisapprove(ids: string[], userId: string) {
    // For now, we'll just return success since the table doesn't exist
    return ids.map(id => ({ id, verified: false, verified_by: userId, verified_at: new Date().toISOString() }));
  }
};
