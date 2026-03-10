import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

async function fetchWithRetry(url: string, options: any, maxRetries = 3): Promise<Response> {
  let lastError: Error | null = null;
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const response = await fetch(url, options);
      if (response.status === 429) {
        const retryAfter = response.headers.get('Retry-After');
        const waitTime = retryAfter ? parseInt(retryAfter) * 1000 : Math.pow(2, attempt) * 1000;
        console.log(`Rate limited, waiting ${waitTime}ms before retry ${attempt + 1}/${maxRetries}`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
        continue;
      }
      return response;
    } catch (error: any) {
      lastError = error;
      if (attempt < maxRetries - 1) {
        const waitTime = Math.pow(2, attempt) * 1000;
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }
    }
  }
  throw lastError || new Error('Max retries exceeded');
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Validate auth
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders });
    }
    const token = authHeader.replace('Bearer ', '');
    const { data: { user: authUser }, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !authUser) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const body = await req.json();
    const { orderIds, userId, userName } = body;

    if (!orderIds || !Array.isArray(orderIds) || orderIds.length === 0) {
      return new Response(JSON.stringify({ error: 'No order IDs provided' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Batch limit to avoid 60s edge function timeout
    const BATCH_LIMIT = 25;
    const batchIds = orderIds.slice(0, BATCH_LIMIT);
    const hasMore = orderIds.length > BATCH_LIMIT;
    const remainingIds = hasMore ? orderIds.slice(BATCH_LIMIT) : [];

    console.log(`check-shopify-delivery: processing ${batchIds.length} of ${orderIds.length} orders for user ${userName}`);

    // Get Shopify credentials from api_settings
    const { data: settings } = await supabaseAdmin
      .from('api_settings')
      .select('setting_key, setting_value')
      .in('setting_key', ['SHOPIFY_STORE_URL', 'SHOPIFY_ADMIN_API_TOKEN', 'SHOPIFY_API_VERSION']);

    if (!settings || settings.length < 2) {
      return new Response(JSON.stringify({ error: 'Shopify credentials not configured' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const storeUrl = settings.find((s: any) => s.setting_key === 'SHOPIFY_STORE_URL')?.setting_value;
    const accessToken = settings.find((s: any) => s.setting_key === 'SHOPIFY_ADMIN_API_TOKEN')?.setting_value;
    const apiVersion = settings.find((s: any) => s.setting_key === 'SHOPIFY_API_VERSION')?.setting_value || '2024-01';

    if (!storeUrl || !accessToken) {
      return new Response(JSON.stringify({ error: 'Incomplete Shopify credentials' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Fetch orders from DB
    const { data: orders, error: fetchError } = await supabaseAdmin
      .from('orders')
      .select('id, order_number, shopify_order_id, status')
      .in('id', batchIds);

    if (fetchError) throw fetchError;
    if (!orders || orders.length === 0) {
      return new Response(JSON.stringify({ updated: 0, failed: 0, failedIds: [], skippedNoShopifyId: 0, hasMore, remainingIds }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    let updated = 0;
    let failed = 0;
    const failedIds: string[] = [];
    let skippedNoShopifyId = 0;
    const now = new Date().toISOString();

    for (const order of orders) {
      if (!order.shopify_order_id) {
        console.log(`Order ${order.order_number} has no shopify_order_id, skipping`);
        skippedNoShopifyId++;
        continue;
      }

      try {
        const shopifyResponse = await fetchWithRetry(
          `${storeUrl}/admin/api/${apiVersion}/orders/${order.shopify_order_id}.json`,
          {
            headers: {
              'X-Shopify-Access-Token': accessToken,
              'Content-Type': 'application/json',
            },
          }
        );

        if (!shopifyResponse.ok) {
          console.error(`Shopify API error for order ${order.order_number}: ${shopifyResponse.status}`);
          failed++;
          failedIds.push(order.id);
          if (shopifyResponse.status !== 404) {
            await shopifyResponse.text(); // consume body
          }
          continue;
        }

        const shopifyData = await shopifyResponse.json();
        const shopifyOrder = shopifyData.order;

        // Determine if delivered/fulfilled
        const isDelivered =
          shopifyOrder.fulfillment_status === 'fulfilled' ||
          (shopifyOrder.fulfillments && shopifyOrder.fulfillments.some(
            (f: any) => f.status === 'success' || f.shipment_status === 'delivered'
          ));

        if (!isDelivered) {
          console.log(`Order ${order.order_number} not delivered in Shopify, skipping`);
          // Not a failure, just not delivered yet
          await new Promise(resolve => setTimeout(resolve, 600));
          continue;
        }

        // Get delivered datetime from fulfillment
        const fulfillment = shopifyOrder.fulfillments?.[0];
        const deliveredAt = fulfillment?.updated_at || now;

        // Update order
        const { error: updateError } = await supabaseAdmin
          .from('orders')
          .update({
            status: 'delivered',
            delivered_at: deliveredAt,
            updated_at: now,
          })
          .eq('id', order.id);

        if (updateError) {
          console.error(`Failed to update order ${order.order_number}:`, updateError);
          failed++;
          failedIds.push(order.id);
          await new Promise(resolve => setTimeout(resolve, 600));
          continue;
        }

        // Insert activity log
        await supabaseAdmin.from('activity_logs').insert({
          user_id: userId,
          entity_type: 'order',
          entity_id: order.id,
          action: 'mark_delivered_shopify_sync',
          details: {
            done_by: 'shopify',
            requested_by_user_id: userId,
            requested_by_user_name: userName,
            marked_text: `done by shopify on request of ${userName}`,
            shopify_status_snapshot: {
              fulfillment_status: shopifyOrder.fulfillment_status,
              fulfillments_count: shopifyOrder.fulfillments?.length || 0,
              first_fulfillment_status: fulfillment?.status,
              shipment_status: fulfillment?.shipment_status,
            },
            effective_datetime: deliveredAt,
            marked_at: now,
            order_number: order.order_number,
            previous_status: order.status,
          },
        });

        updated++;
        console.log(`✓ Order ${order.order_number} marked delivered from Shopify`);

        // Rate limit delay
        await new Promise(resolve => setTimeout(resolve, 600));
      } catch (error: any) {
        console.error(`Error processing order ${order.order_number}:`, error);
        failed++;
        failedIds.push(order.id);
      }
    }

    const result = { updated, failed, failedIds, skippedNoShopifyId, hasMore, remainingIds };
    console.log(`check-shopify-delivery complete:`, result);

    return new Response(JSON.stringify(result), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (error: any) {
    console.error('check-shopify-delivery error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
