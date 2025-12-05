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
    
    console.log(`🌙 Starting nightly tracking update (trigger: ${trigger})...`);
    
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get all orders that are NOT in terminal states and have tracking
    // Terminal states: delivered, cancelled, returned
    const { data: activeOrders, error: fetchError } = await supabase
      .from('orders')
      .select(`
        id,
        order_number,
        status,
        courier,
        tracking_id
      `)
      .not('status', 'in', '("delivered","cancelled","returned")')
      .not('tracking_id', 'is', null)
      .neq('tracking_id', '');

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

    // Process in batches to avoid timeout
    const batchSize = 20;
    for (let i = 0; i < (activeOrders?.length || 0); i += batchSize) {
      const batch = activeOrders!.slice(i, i + batchSize);
      
      console.log(`Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil((activeOrders?.length || 1) / batchSize)}`);
      
      // Process batch in parallel
      await Promise.all(batch.map(async (order) => {
        try {
          console.log(`🔍 Tracking order ${order.order_number} - ${order.courier} - ${order.tracking_id}`);
          
          // Call the courier-tracking function
          const { data: trackingData, error: trackingError } = await supabase.functions.invoke(
            'courier-tracking',
            {
              body: {
                trackingId: order.tracking_id,
                courierCode: order.courier
              }
            }
          );

          if (trackingError) {
            console.error(`Failed to track ${order.tracking_id}:`, trackingError);
            results.failed++;
            results.errors.push({
              order_id: order.id,
              order_number: order.order_number,
              tracking_id: order.tracking_id,
              error: trackingError.message
            });
            return;
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
      }));
      
      // Small delay between batches to avoid rate limiting
      if (i + batchSize < (activeOrders?.length || 0)) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }

    console.log('✨ Nightly tracking update complete:', results);

    return new Response(
      JSON.stringify({
        success: true,
        trigger,
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
