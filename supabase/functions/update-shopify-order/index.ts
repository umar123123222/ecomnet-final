import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.2';
import { getAPISetting } from '../_shared/apiSettings.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface UpdateOrderRequest {
  order_id: string;
  action: 'update_tracking' | 'update_tags' | 'update_fulfillment' | 'update_customer' | 'update_address' | 'update_line_items';
  data: {
    tracking_number?: string;
    tracking_company?: string;
    tracking_url?: string;
    tags?: string[];
    fulfillment_status?: 'fulfilled' | 'partial' | 'unfulfilled';
    customer_note?: string;
    notify_customer?: boolean;
    address?: {
      first_name?: string;
      last_name?: string;
      address1?: string;
      address2?: string;
      city?: string;
      province?: string;
      zip?: string;
      country?: string;
      phone?: string;
    };
    line_items?: Array<{
      variant_id: number;
      quantity: number;
    }>;
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
      // Get order details first
      const orderResponse = await fetch(`${baseUrl}/orders/${shopifyOrderId}.json`, { headers });
      
      if (!orderResponse.ok) {
        throw new Error('Failed to fetch order from Shopify');
      }
      
      const orderText = await orderResponse.text();
      if (!orderText) {
        throw new Error('Empty response from Shopify when fetching order');
      }
      const orderData = JSON.parse(orderText);
      
      // Check if fulfillment exists
      if (!orderData.order.fulfillments || orderData.order.fulfillments.length === 0) {
      console.log('Creating fulfillment with tracking:', {
        orderId: shopifyOrderId,
        trackingNumber: data.tracking_number,
        trackingCompany: data.tracking_company,
        endpoint: `${baseUrl}/orders/${shopifyOrderId}/fulfillments.json`,
      });

      // Create new fulfillment with tracking
      const createResponse = await fetch(`${baseUrl}/orders/${shopifyOrderId}/fulfillments.json`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            fulfillment: {
              location_id: null,
              tracking_number: data.tracking_number,
              tracking_company: data.tracking_company || 'Custom',
              tracking_url: data.tracking_url,
              notify_customer: data.notify_customer || false,
            },
          }),
        });

        if (!createResponse.ok) {
          const errorText = await createResponse.text();
          const error = errorText ? JSON.parse(errorText) : { message: 'Unknown error' };
          console.error('Failed to create fulfillment:', {
            status: createResponse.status,
            statusText: createResponse.statusText,
            headers: Object.fromEntries(createResponse.headers.entries()),
            error,
            orderId: shopifyOrderId,
          });
          throw new Error(`Failed to create fulfillment (${createResponse.status}): ${JSON.stringify(error)}`);
        }

        console.log('Successfully created fulfillment with tracking');
        
        // Check if response has content before parsing
        const text = await createResponse.text();
        return text ? JSON.parse(text) : { success: true };
      }

      // Fulfillment exists, update it
      const fulfillmentId = orderData.order.fulfillments[0].id;
      
      console.log('Updating existing fulfillment:', {
        fulfillmentId,
        orderId: shopifyOrderId,
        trackingNumber: data.tracking_number,
        endpoint: `${baseUrl}/fulfillments/${fulfillmentId}.json`,
      });

      const updateResponse = await fetch(`${baseUrl}/fulfillments/${fulfillmentId}.json`, {
        method: 'PUT',
        headers,
        body: JSON.stringify({
          fulfillment: {
            tracking_info: {
              number: data.tracking_number,
              company: data.tracking_company || 'Custom',
              url: data.tracking_url,
            },
            notify_customer: data.notify_customer || false,
          },
        }),
      });

      if (!updateResponse.ok) {
        const errorText = await updateResponse.text();
        const error = errorText ? JSON.parse(errorText) : { message: 'Unknown error' };
        console.error('Failed to update fulfillment tracking:', {
          status: updateResponse.status,
          statusText: updateResponse.statusText,
          headers: Object.fromEntries(updateResponse.headers.entries()),
          error,
          orderId: shopifyOrderId,
          fulfillmentId,
        });
        throw new Error(`Failed to update tracking (${updateResponse.status}): ${JSON.stringify(error)}`);
      }

      console.log('Successfully updated fulfillment tracking');
      
      // Check if response has content before parsing
      const text = await updateResponse.text();
      return text ? JSON.parse(text) : { success: true };
    }

    case 'update_tags': {
      // First, fetch the current order to get existing tags
      const getResponse = await fetch(`${baseUrl}/orders/${shopifyOrderId}.json`, { headers });
      
      if (!getResponse.ok) {
        throw new Error('Failed to fetch existing order tags');
      }
      
      const getResponseText = await getResponse.text();
      if (!getResponseText) {
        throw new Error('Empty response from Shopify when fetching order tags');
      }
      const orderData = JSON.parse(getResponseText);
      const existingTagsString = orderData.order.tags || '';
      const existingTags = existingTagsString.split(',').map((t: string) => t.trim()).filter(Boolean);
      
      // Remove old Ecomnet status tags from existing tags
      const filteredExistingTags = existingTags.filter((tag: string) => 
        !tag.startsWith('Ecomnet - ')
      );
      
      // Merge with new tags (avoid duplicates)
      const newTags = data.tags || [];
      const mergedTags = [...new Set([...filteredExistingTags, ...newTags])];
      
      console.log('Updating Shopify order tags:', {
        orderId: shopifyOrderId,
        existingTags: filteredExistingTags,
        newTags,
        mergedTags,
        endpoint: `${baseUrl}/orders/${shopifyOrderId}.json`,
      });

      // Update with merged tags
      const response = await fetch(`${baseUrl}/orders/${shopifyOrderId}.json`, {
        method: 'PUT',
        headers,
        body: JSON.stringify({
          order: {
            tags: mergedTags.join(', '),
          },
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        const error = errorText ? JSON.parse(errorText) : { message: 'Unknown error' };
        console.error('Shopify API error response for update_tags:', {
          status: response.status,
          statusText: response.statusText,
          headers: Object.fromEntries(response.headers.entries()),
          error,
          orderId: shopifyOrderId,
        });
        throw new Error(`Failed to update tags (${response.status}): ${JSON.stringify(error)}`);
      }

      // Check if response has content before parsing
      const text = await response.text();
      const result = text ? JSON.parse(text) : { success: true, order: { tags: data.tags?.join(', ') } };
      
      console.log('Shopify update_tags successful:', {
        shopify_order_id: shopifyOrderId,
        updated_tags: result.order?.tags,
      });

      return result;
    }

    case 'update_fulfillment': {
      console.log('Creating fulfillment:', {
        orderId: shopifyOrderId,
        trackingNumber: data.tracking_number,
        endpoint: `${baseUrl}/orders/${shopifyOrderId}/fulfillments.json`,
      });

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
        const errorText = await response.text();
        const error = errorText ? JSON.parse(errorText) : { message: 'Unknown error' };
        console.error('Failed to create fulfillment:', {
          status: response.status,
          statusText: response.statusText,
          headers: Object.fromEntries(response.headers.entries()),
          error,
          orderId: shopifyOrderId,
        });
        throw new Error(`Failed to create fulfillment (${response.status}): ${JSON.stringify(error)}`);
      }

      // Check if response has content before parsing
      const text = await response.text();
      return text ? JSON.parse(text) : { success: true };
    }

    case 'update_customer': {
      console.log('Updating customer note:', {
        orderId: shopifyOrderId,
        endpoint: `${baseUrl}/orders/${shopifyOrderId}.json`,
      });

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
        const errorText = await response.text();
        const error = errorText ? JSON.parse(errorText) : { message: 'Unknown error' };
        console.error('Failed to update customer note:', {
          status: response.status,
          statusText: response.statusText,
          headers: Object.fromEntries(response.headers.entries()),
          error,
          orderId: shopifyOrderId,
        });
        throw new Error(`Failed to update customer note (${response.status}): ${JSON.stringify(error)}`);
      }

      // Check if response has content before parsing
      const text = await response.text();
      return text ? JSON.parse(text) : { success: true };
    }

    case 'update_address': {
      console.log('Updating shipping address:', {
        orderId: shopifyOrderId,
        address: data.address,
        endpoint: `${baseUrl}/orders/${shopifyOrderId}.json`,
      });

      const response = await fetch(`${baseUrl}/orders/${shopifyOrderId}.json`, {
        method: 'PUT',
        headers,
        body: JSON.stringify({
          order: {
            shipping_address: data.address,
          },
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        const error = errorText ? JSON.parse(errorText) : { message: 'Unknown error' };
        console.error('Failed to update address:', {
          status: response.status,
          statusText: response.statusText,
          headers: Object.fromEntries(response.headers.entries()),
          error,
          orderId: shopifyOrderId,
        });
        throw new Error(`Failed to update address (${response.status}): ${JSON.stringify(error)}`);
      }

      // Check if response has content before parsing
      const text = await response.text();
      return text ? JSON.parse(text) : { success: true };
    }

    case 'update_line_items': {
      // Note: Shopify doesn't allow editing line items on existing orders
      // This would require canceling and recreating the order
      throw new Error('Line item updates are not supported on existing Shopify orders');
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

    // Extract token from Authorization header
    const authHeader = req.headers.get('Authorization') || '';
    const token = authHeader.replace('Bearer ', '');

    // Check if this is an internal service-role call (from process-sync-queue)
    const isServiceRoleCall = token === supabaseServiceKey;

    // For non-service-role calls, verify user authentication
    let user = null;
    if (!isServiceRoleCall && token) {
      const { data: authData } = await supabase.auth.getUser(token);
      user = authData.user;
    }

    // Reject if neither service-role nor valid user
    if (!isServiceRoleCall && !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(
      `update-shopify-order called: internal=${isServiceRoleCall}, user_id=${user?.id ?? 'service'}`
    );

    const request: UpdateOrderRequest = await req.json();

    console.log('update-shopify-order request body:', {
      order_id: request.order_id,
      action: request.action,
      data: {
        tags: request.data.tags,
        tracking_number: request.data.tracking_number,
        address: request.data.address ? 'present' : 'not provided',
      },
    });

    // Get order from database
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('shopify_order_id, order_number')
      .eq('id', request.order_id)
      .single();

    console.log('Loaded local order for Shopify update:', {
      order_id: request.order_id,
      shopify_order_id: order?.shopify_order_id,
      order_number: order?.order_number,
    });

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
