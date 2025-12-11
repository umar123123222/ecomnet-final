import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Batch processing constants
const BATCH_SIZE = 50;
const MAX_RUNTIME_MS = 50 * 1000; // 50 seconds

// Self-continuation function
async function continueProcessing(supabaseUrl: string, anonKey: string, offset: number) {
  try {
    console.log(`🔄 Self-continuing from offset ${offset}...`);
    const response = await fetch(`${supabaseUrl}/functions/v1/scheduled-courier-tracking`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${anonKey}`,
      },
      body: JSON.stringify({ offset, trigger: 'self-continuation' }),
    });
    console.log(`✅ Self-continuation triggered, status: ${response.status}`);
  } catch (error) {
    console.error('❌ Self-continuation failed:', error);
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    const body = await req.json().catch(() => ({}));
    const offset = body.offset || 0;
    const trigger = body.trigger || 'scheduled';
    
    console.log(`🔄 Starting scheduled courier tracking (offset: ${offset}, trigger: ${trigger})...`);
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get total count first
    const { count: totalCount } = await supabase
      .from('dispatches')
      .select('*', { count: 'exact', head: true })
      .not('tracking_id', 'is', null);

    console.log(`📊 Total dispatches to track: ${totalCount}, starting at offset ${offset}`);

    // Get batch of dispatches that need tracking
    const { data: dispatches, error: fetchError } = await supabase
      .from('dispatches')
      .select(`
        id,
        order_id,
        tracking_id,
        courier,
        courier_id,
        last_tracking_update
      `)
      .not('tracking_id', 'is', null)
      .order('created_at', { ascending: true })
      .range(offset, offset + BATCH_SIZE - 1);

    if (fetchError) {
      console.error('Error fetching dispatches:', fetchError);
      throw fetchError;
    }

    console.log(`📦 Processing ${dispatches?.length || 0} dispatches (batch ${Math.floor(offset / BATCH_SIZE) + 1})`);

    const results = {
      total: totalCount || 0,
      batchSize: dispatches?.length || 0,
      offset,
      updated: 0,
      delivered: 0,
      returned: 0,
      failed: 0,
      noChange: 0,
      errors: [] as any[]
    };

    // Track each dispatch in batch
    for (const dispatch of dispatches || []) {
      // Check timeout
      if (Date.now() - startTime > MAX_RUNTIME_MS) {
        console.log('⏰ Approaching timeout, saving progress...');
        break;
      }

      try {
        // Call the courier-tracking function
        const { data: trackingData, error: trackingError } = await supabase.functions.invoke(
          'courier-tracking',
          {
            body: {
              trackingId: dispatch.tracking_id,
              courierCode: dispatch.courier
            }
          }
        );

        if (trackingError) {
          console.error(`Failed to track ${dispatch.tracking_id}:`, trackingError);
          results.failed++;
          results.errors.push({
            dispatch_id: dispatch.id,
            tracking_id: dispatch.tracking_id,
            error: trackingError.message
          });
          continue;
        }

        if (trackingData?.success && trackingData?.tracking) {
          const tracking = trackingData.tracking;
          
          // Check if status or location has actually changed from last record
          const { data: lastRecord } = await supabase
            .from('courier_tracking_history')
            .select('status, current_location')
            .eq('tracking_id', dispatch.tracking_id)
            .order('checked_at', { ascending: false })
            .limit(1)
            .single();

          const statusChanged = !lastRecord || lastRecord.status !== tracking.status;
          const locationChanged = !lastRecord || lastRecord.current_location !== tracking.currentLocation;
          const hasChange = statusChanged || locationChanged;

          // Update dispatch's last tracking update timestamp
          await supabase
            .from('dispatches')
            .update({
              last_tracking_update: new Date().toISOString(),
              courier_response: tracking.raw
            })
            .eq('id', dispatch.id);

          if (hasChange) {
            // Get courier_id from couriers table if not available on dispatch
            let courierId = dispatch.courier_id;
            if (!courierId && dispatch.courier) {
              const { data: courierData } = await supabase
                .from('couriers')
                .select('id')
                .eq('code', dispatch.courier.toLowerCase())
                .single();
              courierId = courierData?.id || null;
            }

            // Log tracking history only when status or location changes
            if (courierId) {
              await supabase
                .from('courier_tracking_history')
                .insert({
                  dispatch_id: dispatch.id,
                  order_id: dispatch.order_id,
                  courier_id: courierId,
                  tracking_id: dispatch.tracking_id,
                  status: tracking.status,
                  current_location: tracking.currentLocation,
                  raw_response: tracking.raw,
                  checked_at: new Date().toISOString()
                });
            }

            results.updated++;
          } else {
            results.noChange++;
          }

          // Update order status if delivered OR returned
          if (tracking.status === 'delivered') {
            await supabase
              .from('orders')
              .update({
                status: 'delivered',
                delivered_at: new Date().toISOString()
              })
              .eq('id', dispatch.order_id);
            results.delivered++;
            console.log(`📦 Order ${dispatch.order_id} marked as delivered`);
          } else if (tracking.status === 'returned') {
            await supabase
              .from('orders')
              .update({
                status: 'returned',
                returned_at: new Date().toISOString()
              })
              .eq('id', dispatch.order_id);
            results.returned++;
            console.log(`↩️ Order ${dispatch.order_id} marked as returned`);
          }
        }
      } catch (error: any) {
        console.error(`Error processing dispatch ${dispatch.id}:`, error);
        results.failed++;
        results.errors.push({
          dispatch_id: dispatch.id,
          tracking_id: dispatch.tracking_id,
          error: error.message
        });
      }
    }

    const hasMore = (offset + BATCH_SIZE) < (totalCount || 0);
    const nextOffset = offset + BATCH_SIZE;

    console.log(`✨ Batch complete: updated=${results.updated}, delivered=${results.delivered}, returned=${results.returned}, noChange=${results.noChange}, hasMore=${hasMore}`);

    // Self-continue if more batches and triggered by cron
    if (hasMore && (trigger === 'scheduled' || trigger === 'self-continuation')) {
      // @ts-ignore - EdgeRuntime is available in Supabase Edge Functions
      EdgeRuntime.waitUntil(continueProcessing(supabaseUrl, supabaseAnonKey, nextOffset));
    }

    return new Response(
      JSON.stringify({
        success: true,
        hasMore,
        nextOffset: hasMore ? nextOffset : null,
        results
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error: any) {
    console.error('Error in scheduled-courier-tracking:', error);
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
