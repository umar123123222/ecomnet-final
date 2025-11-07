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

async function fetchShopifyCustomerPhone(customerId: number, supabase: any): Promise<string> {
  try {
    // Get Shopify credentials from api_settings
    const { data: settings } = await supabase
      .from('api_settings')
      .select('setting_key, setting_value')
      .in('setting_key', ['SHOPIFY_STORE_URL', 'SHOPIFY_ADMIN_API_TOKEN', 'SHOPIFY_API_VERSION']);
    
    if (!settings || settings.length < 3) {
      console.warn('Shopify credentials not found in api_settings');
      return '';
    }
    
    const storeUrl = settings.find((s: any) => s.setting_key === 'SHOPIFY_STORE_URL')?.setting_value;
    const accessToken = settings.find((s: any) => s.setting_key === 'SHOPIFY_ADMIN_API_TOKEN')?.setting_value;
    const apiVersion = settings.find((s: any) => s.setting_key === 'SHOPIFY_API_VERSION')?.setting_value || '2024-01';
    
    if (!storeUrl || !accessToken) {
      console.warn('Incomplete Shopify credentials');
      return '';
    }
    
    // Fetch customer from Shopify
    const response = await fetch(`${storeUrl}/admin/api/${apiVersion}/customers/${customerId}.json`, {
      headers: {
        'X-Shopify-Access-Token': accessToken,
        'Content-Type': 'application/json',
      },
    });
    
    if (!response.ok) {
      console.warn(`Failed to fetch Shopify customer ${customerId}: ${response.status}`);
      return '';
    }
    
    const data = await response.json();
    const phone = data.customer?.phone || data.customer?.default_address?.phone;
    
    if (phone) {
      console.log(`Fetched phone from Shopify customer API for customer ${customerId}`);
      return phone;
    }
    
    return '';
  } catch (error) {
    console.error('Error fetching Shopify customer phone:', error);
    return '';
  }
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
      let normalizedPhone = order.customer.phone?.replace(/\D/g, '') || order.phone?.replace(/\D/g, '');
      
      // If no phone, try to fetch from Shopify customer API
      if (!normalizedPhone && order.customer.id) {
        console.log(`No phone in order ${order.id}, fetching from Shopify customer API`);
        const fetchedPhone = await fetchShopifyCustomerPhone(order.customer.id, supabase);
        normalizedPhone = fetchedPhone?.replace(/\D/g, '') || '';
        
        if (!normalizedPhone) {
          console.warn(`Unable to fetch phone for order ${order.id}, customer ${order.customer.id}`);
        }
      }
      
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
            phone: normalizedPhone || '',
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
            phone: normalizedPhone || '',
            phone_last_5_chr: normalizedPhone?.slice(-5) || '',
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

    // Prepare phone number
    let orderPhone = order.customer?.phone || order.phone || order.shipping_address?.phone || '';
    
    // If still no phone, try fetching from Shopify (if not already done above for customer)
    if (!orderPhone && order.customer?.id) {
      console.log(`No phone in order data for ${order.id}, attempting final fetch from Shopify`);
      orderPhone = await fetchShopifyCustomerPhone(order.customer.id, supabase);
    }
    
    const normalizedOrderPhone = orderPhone?.replace(/\D/g, '') || '';
    
    const orderData = {
      order_number: `SHOP-${order.order_number}`,
      shopify_order_number: order.order_number.toString(),
      shopify_order_id: order.id,
      customer_id: customerId,
      customer_name: `${order.customer?.first_name || ''} ${order.customer?.last_name || ''}`.trim() || 'Unknown',
      customer_email: order.customer?.email || order.email,
      customer_phone: normalizedOrderPhone,
      customer_phone_last_5_chr: normalizedOrderPhone?.slice(-5) || '',
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
