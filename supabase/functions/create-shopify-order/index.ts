import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.2';
import { getAPISetting } from '../_shared/apiSettings.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CreateOrderRequest {
  order_id: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Verify authentication
    const authHeader = req.headers.get('Authorization')!;
    const { data: { user }, error: authError } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));
    
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { order_id } = await req.json() as CreateOrderRequest;

    // Get order details from database
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select(`
        *,
        order_items (
          id,
          item_name,
          quantity,
          price
        ),
        customers (
          id,
          name,
          email,
          phone,
          shopify_customer_id
        )
      `)
      .eq('id', order_id)
      .single();

    if (orderError || !order) {
      throw new Error('Order not found');
    }

    // Get Shopify credentials
    const storeUrl = getAPISetting('SHOPIFY_STORE_URL');
    const accessToken = getAPISetting('SHOPIFY_ADMIN_API_TOKEN');
    const apiVersion = getAPISetting('SHOPIFY_API_VERSION') || '2024-01';

    if (!storeUrl || !accessToken) {
      throw new Error('Shopify credentials not configured');
    }

    // Prepare order data for Shopify
    const shopifyOrder = {
      order: {
        email: order.customer_email || order.customers?.email,
        phone: order.customer_phone,
        send_receipt: false,
        send_fulfillment_receipt: false,
        financial_status: 'pending',
        fulfillment_status: null,
        line_items: order.order_items?.map((item: any) => ({
          title: item.item_name,
          quantity: item.quantity,
          price: item.price.toString(),
        })) || [],
        customer: order.customers?.shopify_customer_id ? {
          id: order.customers.shopify_customer_id,
        } : {
          first_name: order.customer_name?.split(' ')[0] || order.customer_name,
          last_name: order.customer_name?.split(' ').slice(1).join(' ') || '',
          email: order.customer_email || order.customers?.email,
          phone: order.customer_phone,
        },
        shipping_address: {
          first_name: order.customer_name?.split(' ')[0] || order.customer_name,
          last_name: order.customer_name?.split(' ').slice(1).join(' ') || '',
          address1: order.customer_address,
          city: order.city,
          country: 'Pakistan',
          phone: order.customer_phone,
        },
        billing_address: {
          first_name: order.customer_name?.split(' ')[0] || order.customer_name,
          last_name: order.customer_name?.split(' ').slice(1).join(' ') || '',
          address1: order.customer_address,
          city: order.city,
          country: 'Pakistan',
          phone: order.customer_phone,
        },
        note: order.notes || '',
        tags: order.tags?.join(', ') || '',
        source_name: 'ERP System',
      },
    };

    // Create order in Shopify
    const shopifyResponse = await fetch(
      `https://${storeUrl}/admin/api/${apiVersion}/orders.json`,
      {
        method: 'POST',
        headers: {
          'X-Shopify-Access-Token': accessToken,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(shopifyOrder),
      }
    );

    if (!shopifyResponse.ok) {
      const errorText = await shopifyResponse.text();
      throw new Error(`Shopify API error: ${shopifyResponse.status} - ${errorText}`);
    }

    const shopifyData = await shopifyResponse.json();
    const createdOrder = shopifyData.order;

    // Update local order with Shopify IDs
    await supabase
      .from('orders')
      .update({
        shopify_order_id: createdOrder.id,
        shopify_order_number: createdOrder.order_number,
        shopify_sync_status: 'synced',
        shopify_last_sync_at: new Date().toISOString(),
        synced_to_shopify: true,
        last_shopify_sync: new Date().toISOString(),
      })
      .eq('id', order_id);

    // Log sync
    await supabase.from('shopify_sync_log').insert({
      sync_type: 'order_create',
      status: 'success',
      records_processed: 1,
      details: { order_id, shopify_order_id: createdOrder.id },
    });

    return new Response(
      JSON.stringify({
        success: true,
        shopify_order_id: createdOrder.id,
        shopify_order_number: createdOrder.order_number,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error creating Shopify order:', error);
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message 
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});