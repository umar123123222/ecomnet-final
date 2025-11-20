// Scanner functions for Returns - extracted for clarity
import { supabase } from '@/integrations/supabase/client';

export const findOrderByEntry = async (entry: string): Promise<{
  order: any;
  matchType: 'order_number' | 'tracking_id';
} | null> => {
  try {
    let { data: orderData } = await supabase
      .from('orders')
      .select('id, tracking_id, order_number, customer_name, total_amount, status')
      .eq('order_number', entry)
      .maybeSingle();

    if (orderData) {
      return { order: orderData, matchType: 'order_number' };
    }

    const { data: partialOrderData } = await supabase
      .from('orders')
      .select('id, tracking_id, order_number, customer_name, total_amount, status')
      .or(`order_number.eq.SHOP-${entry},order_number.ilike.%${entry}%,shopify_order_number.eq.${entry}`)
      .limit(1)
      .maybeSingle();

    if (partialOrderData) {
      return { order: partialOrderData, matchType: 'order_number' };
    }

    const { data: trackingData } = await supabase
      .from('orders')
      .select('id, tracking_id, order_number, customer_name, total_amount, status')
      .eq('tracking_id', entry)
      .maybeSingle();

    if (trackingData) {
      return { order: trackingData, matchType: 'tracking_id' };
    }

    return null;
  } catch (error) {
    console.error('Error searching for order:', error);
    return null;
  }
};
