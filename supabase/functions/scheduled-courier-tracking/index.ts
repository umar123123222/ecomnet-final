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
    console.log('🔄 Starting scheduled courier tracking updates...');
    
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get all active dispatches that need tracking
    const { data: dispatches, error: fetchError } = await supabase
      .from('dispatches')
      .select(`
        id,
        order_id,
        tracking_id,
        courier,
        courier_id,
        status,
        last_tracking_update
      `)
      .not('status', 'in', '("delivered","returned","cancelled")')
      .not('tracking_id', 'is', null);

    if (fetchError) {
      console.error('Error fetching dispatches:', fetchError);
      throw fetchError;
    }

    console.log(`📦 Found ${dispatches?.length || 0} dispatches to track`);

    const results = {
      total: dispatches?.length || 0,
      updated: 0,
      failed: 0,
      errors: [] as any[]
    };

    // Track each dispatch
    for (const dispatch of dispatches || []) {
      try {
        console.log(`🔍 Tracking ${dispatch.courier} - ${dispatch.tracking_id}`);
        
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
          
          // Update dispatch status
          await supabase
            .from('dispatches')
            .update({
              status: tracking.status,
              last_tracking_update: new Date().toISOString(),
              courier_response: tracking.raw
            })
            .eq('id', dispatch.id);

          // Update order status if delivered or returned
          if (tracking.status === 'delivered') {
            await supabase
              .from('orders')
              .update({
                status: 'delivered',
                delivered_at: new Date().toISOString()
              })
              .eq('id', dispatch.order_id);
            
            // Log delivery activity
            await supabase.from('activity_logs').insert({
              user_id: '00000000-0000-0000-0000-000000000000',
              entity_type: 'order',
              entity_id: dispatch.order_id,
              action: 'order_delivered',
              details: {
                courier: dispatch.courier,
                tracking_id: dispatch.tracking_id,
                location: tracking.currentLocation
              }
            });
          } else if (tracking.status === 'returned') {
            await supabase
              .from('orders')
              .update({
                status: 'returned'
              })
              .eq('id', dispatch.order_id);
            
            // Log return activity
            await supabase.from('activity_logs').insert({
              user_id: '00000000-0000-0000-0000-000000000000',
              entity_type: 'order',
              entity_id: dispatch.order_id,
              action: 'order_returned',
              details: {
                courier: dispatch.courier,
                tracking_id: dispatch.tracking_id,
                location: tracking.currentLocation
              }
            });
          }

          // Log tracking history
          await supabase
            .from('courier_tracking_history')
            .insert({
              dispatch_id: dispatch.id,
              order_id: dispatch.order_id,
              courier_id: dispatch.courier_id,
              tracking_id: dispatch.tracking_id,
              status: tracking.status,
              current_location: tracking.currentLocation,
              raw_response: tracking.raw,
              checked_at: new Date().toISOString()
            });

          results.updated++;
          console.log(`✅ Updated ${dispatch.tracking_id}: ${tracking.status}`);
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

    console.log('✨ Scheduled tracking complete:', results);

    return new Response(
      JSON.stringify({
        success: true,
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
