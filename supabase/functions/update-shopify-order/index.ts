import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.2';
import { getAPISetting } from '../_shared/apiSettings.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface UpdateOrderRequest {
  order_id: string;
  action: 'update_tracking' | 'update_tags' | 'update_fulfillment' | 'update_customer';
  data: {
    tracking_number?: string;
    tracking_company?: string;
    tracking_url?: string;
    tags?: string[];
    fulfillment_status?: 'fulfilled' | 'partial' | 'unfulfilled';
    customer_note?: string;
    notify_customer?: boolean;
  };
}

async function updateShopifyOrder(shopifyOrderId: number, action: string, data: any, supabase: any) {
  const storeUrl = await getAPISetting('SHOPIFY_STORE_URL', supabase);
  const apiToken = await getAPISetting('SHOPIFY_ADMIN_API_TOKEN', supabase);
  const apiVersion = await getAPISetting('SHOPIFY_API_VERSION', supabase) || '2024-01';

  if (!storeUrl || !apiToken) {
    throw new Error('Shopify credentials not configured');
  }

  const baseUrl = `${storeUrl}/admin/api/${apiVersion}`;
  const headers = {
    'Content-Type': 'application/json',
    'X-Shopify-Access-Token': apiToken!,
  };

  switch (action) {
    case 'update_tracking': {
      // Get fulfillment ID first
      const orderResponse = await fetch(`${baseUrl}/orders/${shopifyOrderId}.json`, { headers });
      const orderData = await orderResponse.json();
      
      if (!orderData.order.fulfillments || orderData.order.fulfillments.length === 0) {
        throw new Error('No fulfillment found for this order');
      }

      const fulfillmentId = orderData.order.fulfillments[0].id;

      // Update tracking
      const response = await fetch(`${baseUrl}/fulfillments/${fulfillmentId}.json`, {
        method: 'PUT',
        headers,
        body: JSON.stringify({
          fulfillment: {
            tracking_info: {
              number: data.tracking_number,
              company: data.tracking_company,
              url: data.tracking_url,
            },
            notify_customer: data.notify_customer || false,
          },
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(`Failed to update tracking: ${JSON.stringify(error)}`);
      }

      return await response.json();
    }

    case 'update_tags': {
      const response = await fetch(`${baseUrl}/orders/${shopifyOrderId}.json`, {
        method: 'PUT',
        headers,
        body: JSON.stringify({
          order: {
            tags: data.tags.join(', '),
          },
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(`Failed to update tags: ${JSON.stringify(error)}`);
      }

      return await response.json();
    }

    case 'update_fulfillment': {
      // Create fulfillment
      const response = await fetch(`${baseUrl}/orders/${shopifyOrderId}/fulfillments.json`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          fulfillment: {
            location_id: null,
            tracking_number: data.tracking_number,
            tracking_company: data.tracking_company,
            tracking_url: data.tracking_url,
            notify_customer: data.notify_customer || false,
          },
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(`Failed to create fulfillment: ${JSON.stringify(error)}`);
      }

      return await response.json();
    }

    case 'update_customer': {
      const response = await fetch(`${baseUrl}/orders/${shopifyOrderId}.json`, {
        method: 'PUT',
        headers,
        body: JSON.stringify({
          order: {
            note: data.customer_note,
          },
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(`Failed to update customer note: ${JSON.stringify(error)}`);
      }

      return await response.json();
    }

    default:
      throw new Error(`Unknown action: ${action}`);
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

    const { data: authData } = await supabase.auth.getUser(
      req.headers.get('Authorization')?.replace('Bearer ', '') || ''
    );

    if (!authData.user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const request: UpdateOrderRequest = await req.json();

    // Get order from database
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('shopify_order_id, order_number')
      .eq('id', request.order_id)
      .single();

    if (orderError || !order) {
      return new Response(JSON.stringify({ error: 'Order not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!order.shopify_order_id) {
      return new Response(JSON.stringify({ error: 'Order not synced with Shopify' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`Updating Shopify order ${order.shopify_order_id} with action: ${request.action}`);

    // Update Shopify
    const shopifyResponse = await updateShopifyOrder(order.shopify_order_id, request.action, request.data, supabase);

    // Update local database
    const updateData: any = {
      last_shopify_sync: new Date().toISOString(),
    };

    if (request.action === 'update_tracking' && request.data.tracking_number) {
      updateData.tracking_id = request.data.tracking_number;
    }

    if (request.action === 'update_tags' && request.data.tags) {
      updateData.tags = request.data.tags;
    }

    if (request.action === 'update_fulfillment') {
      updateData.status = 'dispatched';
      updateData.dispatched_at = new Date().toISOString();
      if (request.data.tracking_number) {
        updateData.tracking_id = request.data.tracking_number;
      }
    }

    await supabase
      .from('orders')
      .update(updateData)
      .eq('id', request.order_id);

    console.log('Successfully updated order in Shopify and database');

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Order updated successfully',
        shopify_response: shopifyResponse,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error updating Shopify order:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
