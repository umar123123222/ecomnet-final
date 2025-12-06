import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Map Shopify tracking company names to ERP courier codes
function mapShopifyTrackingCompanyToCourier(trackingCompany: string): string {
  const companyLower = trackingCompany.toLowerCase();
  
  if (companyLower.includes('leopard')) return 'leopard';
  if (companyLower.includes('tcs')) return 'tcs';
  if (companyLower.includes('postex') || companyLower.includes('post ex')) return 'postex';
  if (companyLower.includes('trax')) return 'trax';
  if (companyLower.includes('m&p')) return 'm&p';
  
  return trackingCompany;
}

// Map Shopify order financial/fulfillment status to ERP status
function mapShopifyStatusToErp(shopifyOrder: any): string | null {
  // Check if order is cancelled in Shopify
  if (shopifyOrder.cancelled_at) {
    return 'cancelled';
  }
  
  // Check fulfillment status
  const fulfillmentStatus = shopifyOrder.fulfillment_status;
  
  if (fulfillmentStatus === 'fulfilled') {
    // Has fulfillment - should be at least booked
    return 'booked';
  }
  
  // No fulfillment yet - keep pending
  return null;
}

// Helper function to retry with exponential backoff
async function fetchWithRetry(url: string, options: any, maxRetries = 3): Promise<Response> {
  let lastError: Error | null = null;
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const response = await fetch(url, options);
      
      // If we get a 429 (rate limit), wait and retry
      if (response.status === 429) {
        const retryAfter = response.headers.get('Retry-After');
        const waitTime = retryAfter ? parseInt(retryAfter) * 1000 : Math.pow(2, attempt) * 1000;
        console.log(`Rate limited (429), waiting ${waitTime}ms before retry ${attempt + 1}/${maxRetries}`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
        continue;
      }
      
      return response;
    } catch (error: any) {
      lastError = error;
      if (attempt < maxRetries - 1) {
        const waitTime = Math.pow(2, attempt) * 1000;
        console.log(`Request failed, waiting ${waitTime}ms before retry ${attempt + 1}/${maxRetries}`);
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

    // Parse request body for batch parameters
    const body = await req.json().catch(() => ({}));
    const limit = body.limit || 50;
    const offset = body.offset || 0;
    const includeAllPending = body.includeAllPending !== false; // Default true - include all pending orders
    const checkCancelled = body.checkCancelled !== false; // Default true - check for cancelled orders

    console.log(`Starting Shopify sync batch: limit=${limit}, offset=${offset}, includeAllPending=${includeAllPending}`);

    // Get Shopify credentials
    const { data: settings } = await supabaseAdmin
      .from('api_settings')
      .select('setting_key, setting_value')
      .in('setting_key', ['SHOPIFY_STORE_URL', 'SHOPIFY_ADMIN_API_TOKEN', 'SHOPIFY_API_VERSION']);

    if (!settings || settings.length < 2) {
      throw new Error('Shopify credentials not configured');
    }

    const storeUrl = settings.find((s: any) => s.setting_key === 'SHOPIFY_STORE_URL')?.setting_value;
    const accessToken = settings.find((s: any) => s.setting_key === 'SHOPIFY_ADMIN_API_TOKEN')?.setting_value;
    const apiVersion = settings.find((s: any) => s.setting_key === 'SHOPIFY_API_VERSION')?.setting_value || '2024-01';

    if (!storeUrl || !accessToken) {
      throw new Error('Incomplete Shopify credentials');
    }

    console.log('Fetching pending orders to sync from Shopify...');

    // Build query for pending orders with shopify_order_id
    let countQuery = supabaseAdmin
      .from('orders')
      .select('id', { count: 'exact', head: true })
      .not('shopify_order_id', 'is', null)
      .in('status', ['pending', 'confirmed', 'booked']);

    let ordersQuery = supabaseAdmin
      .from('orders')
      .select('id, order_number, shopify_order_id, status, courier, tracking_id')
      .not('shopify_order_id', 'is', null)
      .in('status', ['pending', 'confirmed', 'booked'])
      .order('created_at', { ascending: true })
      .range(offset, offset + limit - 1);

    // Get total count
    const { count: totalCount } = await countQuery;

    // Fetch orders
    const { data: ordersToSync, error: fetchError } = await ordersQuery;

    if (fetchError) throw fetchError;

    if (!ordersToSync || ordersToSync.length === 0) {
      console.log('No orders found in this batch');
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'No orders found in this batch',
          total: totalCount || 0,
          processed: 0,
          remaining: 0,
          hasMore: false,
          updated: 0,
          skipped: 0,
          cancelled: 0,
          errors: 0
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Found ${ordersToSync.length} orders in this batch (${offset + 1}-${offset + ordersToSync.length} of ${totalCount} total)`);

    let updatedCount = 0;
    let skippedCount = 0;
    let cancelledCount = 0;
    let errorCount = 0;

    // Process orders
    for (const order of ordersToSync) {
      try {
        console.log(`Processing order ${order.order_number} (Shopify ID: ${order.shopify_order_id})`);

        // Fetch order from Shopify
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
          if (shopifyResponse.status === 404) {
            console.log(`Order ${order.order_number} not found in Shopify (may be deleted)`);
            skippedCount++;
            continue;
          }
          console.error(`Failed to fetch Shopify order ${order.shopify_order_id}: ${shopifyResponse.status}`);
          errorCount++;
          continue;
        }

        const shopifyData = await shopifyResponse.json();
        const shopifyOrder = shopifyData.order;

        // Check if order is cancelled in Shopify
        if (checkCancelled && shopifyOrder.cancelled_at) {
          console.log(`Order ${order.order_number} is cancelled in Shopify, updating ERP...`);
          
          const { error: updateError } = await supabaseAdmin
            .from('orders')
            .update({
              status: 'cancelled',
              cancellation_reason: shopifyOrder.cancel_reason || 'Cancelled in Shopify',
              updated_at: new Date().toISOString(),
            })
            .eq('id', order.id);

          if (updateError) {
            console.error(`Failed to cancel order ${order.order_number}:`, updateError);
            errorCount++;
            continue;
          }

          // Log activity
          await supabaseAdmin.from('activity_logs').insert({
            action: 'shopify_sync_cancelled',
            entity_type: 'order',
            entity_id: order.id,
            details: {
              order_number: order.order_number,
              previous_status: order.status,
              new_status: 'cancelled',
              cancel_reason: shopifyOrder.cancel_reason,
              source: 'shopify_fulfillment_sync',
            },
            user_id: '00000000-0000-0000-0000-000000000000',
          });

          cancelledCount++;
          console.log(`✓ Cancelled order ${order.order_number}`);
          await new Promise(resolve => setTimeout(resolve, 600));
          continue;
        }

        // Check if order has fulfillments
        if (!shopifyOrder.fulfillments || shopifyOrder.fulfillments.length === 0) {
          console.log(`Order ${order.order_number} has no fulfillments in Shopify, skipping`);
          skippedCount++;
          continue;
        }

        const fulfillment = shopifyOrder.fulfillments[0];
        const trackingNumber = fulfillment.tracking_number;
        const trackingCompany = fulfillment.tracking_company;

        // If order already has same tracking, skip unless status needs update
        if (order.tracking_id === trackingNumber && order.status !== 'pending') {
          console.log(`Order ${order.order_number} already has same tracking ID, skipping`);
          skippedCount++;
          continue;
        }

        // Map tracking company to ERP courier code
        const courierCode = trackingCompany 
          ? mapShopifyTrackingCompanyToCourier(trackingCompany)
          : order.courier || 'unknown';

        // Determine new status - only update to booked if currently pending
        const newStatus = order.status === 'pending' ? 'booked' : order.status;

        const updateData: any = {
          updated_at: new Date().toISOString(),
        };

        // Only update tracking if we have a new one
        if (trackingNumber && trackingNumber !== order.tracking_id) {
          updateData.tracking_id = trackingNumber;
          updateData.courier = courierCode;
        }

        // Update status if changing
        if (newStatus !== order.status) {
          updateData.status = newStatus;
          updateData.booked_at = new Date().toISOString();
        }

        console.log(`Updating order ${order.order_number}: tracking=${trackingNumber}, courier=${courierCode}, status=${newStatus}`);

        // Update order in ERP
        const { error: updateError } = await supabaseAdmin
          .from('orders')
          .update(updateData)
          .eq('id', order.id);

        if (updateError) {
          console.error(`Failed to update order ${order.order_number}:`, updateError);
          errorCount++;
          continue;
        }

        // Log activity
        await supabaseAdmin.from('activity_logs').insert({
          action: 'shopify_sync_fulfillment',
          entity_type: 'order',
          entity_id: order.id,
          details: {
            order_number: order.order_number,
            tracking_id: trackingNumber,
            courier: courierCode,
            previous_status: order.status,
            new_status: newStatus,
            source: 'shopify_fulfillment_sync',
          },
          user_id: '00000000-0000-0000-0000-000000000000',
        });

        updatedCount++;
        console.log(`✓ Successfully updated order ${order.order_number}`);

        // Add delay to stay under Shopify rate limits
        await new Promise(resolve => setTimeout(resolve, 600));

      } catch (error: any) {
        console.error(`Error processing order ${order.order_number}:`, error);
        errorCount++;
      }
    }

    const processedCount = offset + ordersToSync.length;
    const hasMore = (totalCount || 0) > processedCount;
    
    const summary = {
      success: true,
      message: hasMore ? 'Batch completed, more orders remaining' : 'Sync completed',
      total: totalCount || 0,
      processed: processedCount,
      remaining: Math.max(0, (totalCount || 0) - processedCount),
      batch_size: ordersToSync.length,
      updated: updatedCount,
      skipped: skippedCount,
      cancelled: cancelledCount,
      errors: errorCount,
      hasMore: hasMore,
      nextOffset: hasMore ? processedCount : null
    };

    console.log(`Batch complete: ${updatedCount} updated, ${cancelledCount} cancelled, ${skippedCount} skipped, ${errorCount} errors`);

    return new Response(
      JSON.stringify(summary),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error in sync function:', error);
    return new Response(
      JSON.stringify({ 
        success: false,
        error: error.message,
        details: error.stack
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
