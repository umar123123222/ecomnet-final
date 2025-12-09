import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const trigger = body.trigger || 'manual';
    const offset = body.offset || 0;
    // Reduced batch size to 20 to avoid WORKER_LIMIT errors
    const limit = Math.min(body.limit || 20, 20);
    
    console.log(`🌙 Starting nightly tracking update (trigger: ${trigger}, offset: ${offset}, limit: ${limit})...`);
    
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get orders that are NOT in terminal states and have tracking
    const { data: activeOrders, error: fetchError } = await supabase
      .from('orders')
      .select(`
        id,
        order_number,
        status,
        courier,
        tracking_id
      `)
      .eq('status', 'dispatched')
      .not('tracking_id', 'is', null)
      .neq('tracking_id', '')
      .range(offset, offset + limit - 1);

    if (fetchError) {
      console.error('Error fetching active orders:', fetchError);
      throw fetchError;
    }

    console.log(`📦 Found ${activeOrders?.length || 0} active orders with tracking to update`);

    const results = {
      total: activeOrders?.length || 0,
      updated: 0,
      delivered: 0,
      returned: 0,
      failed: 0,
      noChange: 0,
      errors: [] as any[]
    };

    // Process orders SEQUENTIALLY with longer delays to avoid resource limits
    for (const order of activeOrders || []) {
      try {
        console.log(`🔍 Tracking order ${order.order_number} - ${order.courier} - ${order.tracking_id}`);
        
        // Call the courier-tracking function with timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 8000); // 8 second timeout per order
        
        try {
          const { data: trackingData, error: trackingError } = await supabase.functions.invoke(
            'courier-tracking',
            {
              body: {
                trackingId: order.tracking_id,
                courierCode: order.courier
              }
            }
          );
          
          clearTimeout(timeoutId);

          if (trackingError) {
            console.error(`Failed to track ${order.tracking_id}:`, trackingError);
            results.failed++;
            results.errors.push({
              order_id: order.id,
              order_number: order.order_number,
              tracking_id: order.tracking_id,
              error: trackingError.message
            });
            continue;
          }

          if (trackingData?.success && trackingData?.tracking) {
            const tracking = trackingData.tracking;
            
            // Update order status based on tracking status
            if (tracking.status === 'delivered') {
              await supabase
                .from('orders')
                .update({
                  status: 'delivered',
                  delivered_at: new Date().toISOString()
                })
                .eq('id', order.id);
              
              results.delivered++;
              results.updated++;
              console.log(`✅ Order ${order.order_number} marked as DELIVERED`);
              
            } else if (tracking.status === 'returned') {
              await supabase
                .from('orders')
                .update({
                  status: 'returned',
                  returned_at: new Date().toISOString()
                })
                .eq('id', order.id);
              
              results.returned++;
              results.updated++;
              console.log(`↩️ Order ${order.order_number} marked as RETURNED`);
              
            } else {
              results.noChange++;
              console.log(`⏭️ Order ${order.order_number}: ${tracking.status} (no status change needed)`);
            }
          } else {
            results.noChange++;
          }
        } catch (invokeError: any) {
          clearTimeout(timeoutId);
          if (invokeError.name === 'AbortError') {
            console.error(`Timeout tracking ${order.tracking_id}`);
            results.failed++;
            results.errors.push({
              order_id: order.id,
              order_number: order.order_number,
              tracking_id: order.tracking_id,
              error: 'Tracking request timed out'
            });
          } else {
            throw invokeError;
          }
        }
        
        // Longer delay between requests to reduce resource pressure
        await new Promise(resolve => setTimeout(resolve, 500));
        
      } catch (error: any) {
        console.error(`Error processing order ${order.order_number}:`, error);
        results.failed++;
        results.errors.push({
          order_id: order.id,
          order_number: order.order_number,
          tracking_id: order.tracking_id,
          error: error.message
        });
      }
    }

    const hasMore = (activeOrders?.length || 0) === limit;
    console.log(`✨ Nightly tracking update batch complete:`, { ...results, offset, hasMore });

    return new Response(
      JSON.stringify({
        success: true,
        trigger,
        offset,
        limit,
        hasMore,
        results
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error: any) {
    console.error('Error in nightly-tracking-update:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
