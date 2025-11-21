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
        last_tracking_update
      `)
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
          
          // Update dispatch's last tracking update timestamp
          await supabase
            .from('dispatches')
            .update({
              last_tracking_update: new Date().toISOString(),
              courier_response: tracking.raw
            })
            .eq('id', dispatch.id);

          // Log ALL tracking status changes to activity logs (not just delivered/returned)
          const statusDescriptions: Record<string, string> = {
            'booked': `Order booked with ${dispatch.courier}`,
            'picked_up': `Package picked up by ${dispatch.courier}`,
            'in_transit': `Order in transit${tracking.currentLocation ? ` at ${tracking.currentLocation}` : ''}`,
            'out_for_delivery': `Out for delivery${tracking.currentLocation ? ` in ${tracking.currentLocation}` : ''}`,
            'delivered': 'Order successfully delivered',
            'returned': `Order returned by ${dispatch.courier}`,
            'failed_delivery': 'Delivery attempt failed',
            'on_hold': 'Shipment on hold'
          };

          const statusAction = tracking.status.replace(/-/g, '_');
          const actionDescription = statusDescriptions[tracking.status] || `Status updated: ${tracking.status}`;

          // Log to activity logs for ALL statuses
          await supabase.from('activity_logs').insert({
            user_id: '00000000-0000-0000-0000-000000000000',
            entity_type: 'order',
            entity_id: dispatch.order_id,
            action: `tracking_${statusAction}`,
            details: {
              description: actionDescription,
              courier: dispatch.courier,
              tracking_id: dispatch.tracking_id,
              status: tracking.status,
              location: tracking.currentLocation,
              timestamp: new Date().toISOString()
            }
          });

          // Update order status if delivered (but NOT for returned - keep dispatched)
          if (tracking.status === 'delivered') {
            await supabase
              .from('orders')
              .update({
                status: 'delivered',
                delivered_at: new Date().toISOString()
              })
              .eq('id', dispatch.order_id);
          }
          // For returned status, only update dispatch status, NOT order status
          // Order status stays 'dispatched' until warehouse physically receives it

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
