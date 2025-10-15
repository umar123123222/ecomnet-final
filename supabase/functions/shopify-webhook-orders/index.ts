import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.2';
import { crypto } from 'https://deno.land/std@0.177.0/crypto/mod.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-shopify-hmac-sha256, x-shopify-shop-domain, x-shopify-topic',
};

interface ShopifyOrder {
  id: number;
  order_number: number;
  email: string;
  phone: string;
  customer: {
    id: number;
    email: string;
    phone: string;
    first_name: string;
    last_name: string;
  };
  shipping_address: {
    address1: string;
    address2?: string;
    city: string;
    province?: string;
    country: string;
    zip?: string;
  };
  line_items: Array<{
    id: number;
    name: string;
    quantity: number;
    price: string;
    product_id: number;
    variant_id: number;
  }>;
  total_price: string;
  tags: string;
  note?: string;
  fulfillment_status?: string;
}

async function verifyShopifyWebhook(body: string, hmacHeader: string): Promise<boolean> {
  const webhookSecret = Deno.env.get('SHOPIFY_WEBHOOK_SECRET');
  if (!webhookSecret) {
    console.error('SHOPIFY_WEBHOOK_SECRET not configured');
    return false;
  }

  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(webhookSecret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(body));
  const computedHmac = btoa(String.fromCharCode(...new Uint8Array(signature)));

  return computedHmac === hmacHeader;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get the raw body for HMAC verification
    const body = await req.text();
    const hmacHeader = req.headers.get('x-shopify-hmac-sha256');
    const shopDomain = req.headers.get('x-shopify-shop-domain');
    const topic = req.headers.get('x-shopify-topic');

    console.log('Received Shopify webhook:', { topic, shopDomain });

    // Verify webhook authenticity
    if (!hmacHeader || !(await verifyShopifyWebhook(body, hmacHeader))) {
      console.error('Invalid webhook signature');
      return new Response(JSON.stringify({ error: 'Invalid signature' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const order: ShopifyOrder = JSON.parse(body);

    // Check if customer exists, create or update
    let customerId: string | null = null;
    if (order.customer) {
      const normalizedPhone = order.customer.phone?.replace(/\D/g, '') || order.phone?.replace(/\D/g, '');
      
      const { data: existingCustomer } = await supabase
        .from('customers')
        .select('id')
        .eq('shopify_customer_id', order.customer.id)
        .single();

      if (existingCustomer) {
        customerId = existingCustomer.id;
        
        // Update customer
        await supabase
          .from('customers')
          .update({
            name: `${order.customer.first_name} ${order.customer.last_name}`,
            email: order.customer.email,
            phone: normalizedPhone,
            updated_at: new Date().toISOString(),
          })
          .eq('id', customerId);
      } else {
        // Create new customer
        const { data: newCustomer } = await supabase
          .from('customers')
          .insert({
            name: `${order.customer.first_name} ${order.customer.last_name}`,
            email: order.customer.email,
            phone: normalizedPhone,
            phone_last_5_chr: normalizedPhone?.slice(-5),
            shopify_customer_id: order.customer.id,
            total_orders: 0,
            return_count: 0,
          })
          .select('id')
          .single();
        
        customerId = newCustomer?.id || null;
      }
    }

    // Check if order already exists
    const { data: existingOrder } = await supabase
      .from('orders')
      .select('id')
      .eq('shopify_order_id', order.id)
      .single();

    const orderData = {
      order_number: `SHOP-${order.order_number}`,
      shopify_order_number: order.order_number.toString(),
      shopify_order_id: order.id,
      customer_id: customerId,
      customer_name: `${order.customer?.first_name || ''} ${order.customer?.last_name || ''}`.trim() || 'Unknown',
      customer_email: order.customer?.email || order.email,
      customer_phone: order.customer?.phone || order.phone,
      customer_phone_last_5_chr: (order.customer?.phone || order.phone)?.replace(/\D/g, '').slice(-5),
      customer_address: order.shipping_address.address1,
      city: order.shipping_address.city,
      total_amount: parseFloat(order.total_price),
      total_items: order.line_items.length.toString(),
      tags: order.tags ? order.tags.split(',').map(t => t.trim()) : [],
      notes: order.note,
      status: order.fulfillment_status === 'fulfilled' ? 'delivered' : 'pending',
      synced_to_shopify: true,
      last_shopify_sync: new Date().toISOString(),
      items: order.line_items.map(item => ({
        id: item.id,
        name: item.name,
        quantity: item.quantity,
        price: item.price,
        product_id: item.product_id,
        variant_id: item.variant_id,
      })),
    };

    if (existingOrder) {
      // Update existing order
      await supabase
        .from('orders')
        .update(orderData)
        .eq('id', existingOrder.id);
      
      console.log('Updated existing order:', existingOrder.id);
    } else {
      // Create new order
      const { data: newOrder, error: orderError } = await supabase
        .from('orders')
        .insert(orderData)
        .select('id')
        .single();

      if (orderError) {
        console.error('Error creating order:', orderError);
        throw orderError;
      }

      // Create order items
      if (newOrder && order.line_items.length > 0) {
        const orderItems = order.line_items.map(item => ({
          order_id: newOrder.id,
          item_name: item.name,
          quantity: item.quantity,
          price: parseFloat(item.price),
        }));

        await supabase.from('order_items').insert(orderItems);
      }

      console.log('Created new order:', newOrder?.id);
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error processing Shopify webhook:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
