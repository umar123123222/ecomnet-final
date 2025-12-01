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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get Shopify credentials
    const { data: settings } = await supabaseAdmin
      .from('api_settings')
      .select('setting_key, setting_value')
      .in('setting_key', ['SHOPIFY_STORE_URL', 'SHOPIFY_ADMIN_API_TOKEN', 'SHOPIFY_API_VERSION']);

    if (!settings || settings.length < 3) {
      throw new Error('Shopify credentials not configured');
    }

    const storeUrl = settings.find((s: any) => s.setting_key === 'SHOPIFY_STORE_URL')?.setting_value;
    const accessToken = settings.find((s: any) => s.setting_key === 'SHOPIFY_ADMIN_API_TOKEN')?.setting_value;
    const apiVersion = settings.find((s: any) => s.setting_key === 'SHOPIFY_API_VERSION')?.setting_value || '2024-01';

    if (!storeUrl || !accessToken) {
      throw new Error('Incomplete Shopify credentials');
    }

    console.log('Starting backfill of Shopify fulfillments from Nov 29, 2024...');

    // Fetch orders from Nov 29, 2024 onwards that:
    // 1. Have shopify_order_id (synced from Shopify)
    // 2. Don't have tracking_id in ERP
    // 3. Have status pending, confirmed, or booked
    const { data: ordersToBackfill, error: fetchError } = await supabaseAdmin
      .from('orders')
      .select('id, order_number, shopify_order_id, status, courier, tracking_id')
      .not('shopify_order_id', 'is', null)
      .is('tracking_id', null)
      .in('status', ['pending', 'confirmed', 'booked'])
      .gte('created_at', '2024-11-29T00:00:00Z')
      .order('created_at', { ascending: true });

    if (fetchError) throw fetchError;

    if (!ordersToBackfill || ordersToBackfill.length === 0) {
      console.log('No orders found that need backfilling');
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'No orders found that need backfilling',
          processed: 0 
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Found ${ordersToBackfill.length} orders to backfill`);

    let updatedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;
    const results: any[] = [];

    // Process orders in batches to avoid rate limits
    for (const order of ordersToBackfill) {
      try {
        console.log(`Processing order ${order.order_number} (Shopify ID: ${order.shopify_order_id})`);

        // Fetch order from Shopify to get fulfillment data
        const shopifyResponse = await fetch(
          `${storeUrl}/admin/api/${apiVersion}/orders/${order.shopify_order_id}.json`,
          {
            headers: {
              'X-Shopify-Access-Token': accessToken,
              'Content-Type': 'application/json',
            },
          }
        );

        if (!shopifyResponse.ok) {
          console.error(`Failed to fetch Shopify order ${order.shopify_order_id}: ${shopifyResponse.status}`);
          errorCount++;
          results.push({
            order_number: order.order_number,
            status: 'error',
            message: `Failed to fetch from Shopify: ${shopifyResponse.status}`
          });
          continue;
        }

        const shopifyData = await shopifyResponse.json();
        const shopifyOrder = shopifyData.order;

        // Check if order has fulfillments
        if (!shopifyOrder.fulfillments || shopifyOrder.fulfillments.length === 0) {
          console.log(`Order ${order.order_number} has no fulfillments in Shopify, skipping`);
          skippedCount++;
          results.push({
            order_number: order.order_number,
            status: 'skipped',
            message: 'No fulfillments in Shopify'
          });
          continue;
        }

        const fulfillment = shopifyOrder.fulfillments[0];
        const trackingNumber = fulfillment.tracking_number;
        const trackingCompany = fulfillment.tracking_company;

        if (!trackingNumber) {
          console.log(`Order ${order.order_number} fulfillment has no tracking number, skipping`);
          skippedCount++;
          results.push({
            order_number: order.order_number,
            status: 'skipped',
            message: 'No tracking number in fulfillment'
          });
          continue;
        }

        // Map tracking company to ERP courier code
        const courierCode = trackingCompany 
          ? mapShopifyTrackingCompanyToCourier(trackingCompany)
          : order.courier || 'unknown';

        // Determine new status
        const newStatus = order.status === 'pending' ? 'booked' : order.status;

        console.log(`Updating order ${order.order_number}: tracking=${trackingNumber}, courier=${courierCode}, status=${newStatus}`);

        // Update order in ERP
        const { error: updateError } = await supabaseAdmin
          .from('orders')
          .update({
            tracking_id: trackingNumber,
            courier: courierCode,
            status: newStatus,
            booked_at: newStatus === 'booked' ? new Date().toISOString() : null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', order.id);

        if (updateError) {
          console.error(`Failed to update order ${order.order_number}:`, updateError);
          errorCount++;
          results.push({
            order_number: order.order_number,
            status: 'error',
            message: updateError.message
          });
          continue;
        }

        // Log activity
        await supabaseAdmin
          .from('activity_logs')
          .insert({
            action: 'backfill_fulfillment',
            entity_type: 'order',
            entity_id: order.id,
            details: {
              order_number: order.order_number,
              tracking_id: trackingNumber,
              courier: courierCode,
              previous_status: order.status,
              new_status: newStatus,
              source: 'shopify_fulfillment_backfill',
            },
            user_id: '00000000-0000-0000-0000-000000000000', // System user
          });

        updatedCount++;
        results.push({
          order_number: order.order_number,
          status: 'updated',
          tracking_id: trackingNumber,
          courier: courierCode,
          new_status: newStatus
        });

        console.log(`✓ Successfully updated order ${order.order_number}`);

        // Add a small delay to avoid rate limits (350ms = ~170 requests/minute, well under Shopify's 2/sec limit)
        await new Promise(resolve => setTimeout(resolve, 350));

      } catch (error: any) {
        console.error(`Error processing order ${order.order_number}:`, error);
        errorCount++;
        results.push({
          order_number: order.order_number,
          status: 'error',
          message: error.message
        });
      }
    }

    const summary = {
      success: true,
      message: 'Backfill completed',
      total_orders: ordersToBackfill.length,
      updated: updatedCount,
      skipped: skippedCount,
      errors: errorCount,
      results: results
    };

    console.log('Backfill summary:', JSON.stringify(summary, null, 2));

    return new Response(
      JSON.stringify(summary),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error in backfill function:', error);
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
