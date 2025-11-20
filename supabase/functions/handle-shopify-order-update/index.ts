import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.2';
import { createHmac } from 'https://deno.land/std@0.177.0/node/crypto.ts';
import { getEcomnetStatusTag, updateEcomnetStatusTag } from '../_shared/ecomnetStatusTags.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-shopify-hmac-sha256, x-shopify-topic, x-shopify-shop-domain',
};

function verifyWebhook(body: string, hmacHeader: string, secret: string): boolean {
  const hash = createHmac('sha256', secret)
    .update(body, 'utf8')
    .digest('base64');
  return hash === hmacHeader;
}

function generateShopifyTags(order: any, existingTags: string[] = []): string[] {
  // Remove all existing "Shopify - *" tags
  const nonShopifyTags = existingTags.filter(tag => !tag.startsWith('Shopify - '));
  const shopifyTags: string[] = [];
  
  // Add fulfillment status tag
  if (order.fulfillment_status === 'fulfilled') {
    shopifyTags.push('Shopify - Fulfilled');
  } else if (order.fulfillment_status === 'partial') {
    shopifyTags.push('Shopify - Partially Fulfilled');
  }
  
  // Add financial status tag
  if (order.financial_status === 'paid') {
    shopifyTags.push('Shopify - Paid');
  } else if (order.financial_status === 'pending') {
    shopifyTags.push('Shopify - Pending Payment');
  } else if (order.financial_status === 'refunded') {
    shopifyTags.push('Shopify - Refunded');
  } else if (order.financial_status === 'voided') {
    shopifyTags.push('Shopify - Voided');
  }
  
  // Add cancellation tag
  if (order.cancelled_at) {
    shopifyTags.push('Shopify - Cancelled');
  }
  
  // Combine non-Shopify tags with new Shopify tags
  return [...nonShopifyTags, ...shopifyTags];
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
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get webhook headers
    const hmacHeader = req.headers.get('x-shopify-hmac-sha256');
    const topic = req.headers.get('x-shopify-topic');
    const shopDomain = req.headers.get('x-shopify-shop-domain');

    // Get body as text for HMAC verification
    const bodyText = await req.text();

    // Verify webhook signature
    const webhookSecret = Deno.env.get('SHOPIFY_WEBHOOK_SECRET');
    if (webhookSecret && hmacHeader) {
      const isValid = verifyWebhook(bodyText, hmacHeader, webhookSecret);
      if (!isValid) {
        console.error('Invalid webhook signature');
        return new Response(JSON.stringify({ error: 'Invalid signature' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    const order = JSON.parse(bodyText);
    console.log(`Received webhook: ${topic} for order ${order.id}`);

    // Update webhook registry last triggered time
    await supabase
      .from('shopify_webhook_registry')
      .update({ last_triggered: new Date().toISOString() })
      .eq('topic', topic || 'orders/updated');

    // Find the order in our database by Shopify order ID
    const { data: existingOrder, error: findError } = await supabase
      .from('orders')
      .select('id, tags')
      .eq('shopify_order_id', order.id.toString())
      .single();

    if (findError || !existingOrder) {
      console.log(`Order not found in database for Shopify ID ${order.id}`);
      return new Response(JSON.stringify({ success: true, message: 'Order not found' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Generate Shopify tags based on order state
    const updatedTags = generateShopifyTags(order, existingOrder.tags || []);

    // Extract tracking info
    let trackingId = null;
    if (order.fulfillments && order.fulfillments.length > 0) {
      const fulfillment = order.fulfillments[0];
      if (fulfillment.tracking_number) {
        trackingId = fulfillment.tracking_number;
      }
    }

    // Extract address changes
    const shippingAddress = order.shipping_address;
    
    // Update order in our database
    const updateData: any = {
      tags: updatedTags,
      last_shopify_sync: new Date().toISOString(),
    };

    // Exception: Set status to cancelled if order is cancelled in Shopify
    if (order.cancelled_at) {
      updateData.status = 'cancelled';
      updateData.notes = `Order cancelled in Shopify at ${order.cancelled_at}. Reason: ${order.cancel_reason || 'Not specified'}`;
    }

    await supabase
      .from('orders')
      .update(updateData)
      .eq('id', existingOrder.id);

    console.log(`Updated order ${existingOrder.id} from Shopify webhook: ${topic}`);

    // Log the sync
    await supabase.from('shopify_sync_log').insert({
      sync_type: 'order_update_webhook',
      status: 'success',
      records_processed: 1,
      details: {
        shopify_order_id: order.id,
        local_order_id: existingOrder.id,
        topic,
        status: updateData.status || existingOrder.status,
      },
    });

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error handling order update webhook:', error);
    
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