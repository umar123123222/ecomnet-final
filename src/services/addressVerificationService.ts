
import { supabase } from '@/integrations/supabase/client';

export interface AddressVerification {
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
  }) {
    let query = supabase
      .from('address_verifications')
      .select(`
        *,
        order:orders(
          id,
          customer_id,
          shipping_address,
          tracking_id,
          customer:customers(name, phone)
        ),
        verifier:users(name)
      `)
      .order('created_at', { ascending: false });

    if (filters?.verified !== undefined) {
      query = query.eq('verified', filters.verified);
    }

    if (filters?.search) {
      query = query.or(`order.tracking_id.ilike.%${filters.search}%,order.customer.name.ilike.%${filters.search}%,order.customer.phone.ilike.%${filters.search}%`);
    }

    const { data, error } = await query;

    if (error) throw error;
    return data as AddressVerification[];
  },

  async approveAddress(id: string, userId: string) {
    const { data, error } = await supabase
      .from('address_verifications')
      .update({
        verified: true,
        verified_by: userId,
        verified_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async disapproveAddress(id: string, userId: string) {
    const { data, error } = await supabase
      .from('address_verifications')
      .update({
        verified: false,
        verified_by: userId,
        verified_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async bulkApprove(ids: string[], userId: string) {
    const { data, error } = await supabase
      .from('address_verifications')
      .update({
        verified: true,
        verified_by: userId,
        verified_at: new Date().toISOString()
      })
      .in('id', ids)
      .select();

    if (error) throw error;
    return data;
  },

  async bulkDisapprove(ids: string[], userId: string) {
    const { data, error } = await supabase
      .from('address_verifications')
      .update({
        verified: false,
        verified_by: userId,
        verified_at: new Date().toISOString()
      })
      .in('id', ids)
      .select();

    if (error) throw error;
    return data;
  }
};
