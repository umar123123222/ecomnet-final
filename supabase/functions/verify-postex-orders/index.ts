import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { batchSize = 50, onlyUnverified = true } = await req.json().catch(() => ({}));
    const limit = Math.min(Math.max(batchSize, 1), 100);

    console.log(`Starting PostEx verification (batch: ${limit}, onlyUnverified: ${onlyUnverified})...`);

    // Get PostEx delivered orders - prioritize those without tracking history
    let query = supabaseAdmin
      .from('orders')
      .select('id, order_number, status, courier, tracking_id, tags, delivered_at')
      .eq('status', 'delivered')
      .eq('courier', 'postex')
      .not('tracking_id', 'is', null)
      .gte('delivered_at', '2025-12-01')
      .lte('delivered_at', '2025-12-19T23:59:59')
      .order('delivered_at', { ascending: true })
      .limit(limit);

    const { data: deliveredOrders, error: fetchError } = await query;

    if (fetchError) {
      console.error('Error fetching PostEx orders:', fetchError);
      throw fetchError;
    }

    if (!deliveredOrders || deliveredOrders.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'No PostEx orders to verify',
          verified: 0,
          downgraded: 0
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // If onlyUnverified, filter to orders without recent tracking history
    let ordersToVerify = deliveredOrders;
    
    if (onlyUnverified) {
      const orderIds = deliveredOrders.map(o => o.id);
      const { data: trackingHistory } = await supabaseAdmin
        .from('courier_tracking_history')
        .select('order_id')
        .in('order_id', orderIds);
      
      const verifiedOrderIds = new Set(trackingHistory?.map(t => t.order_id) || []);
      ordersToVerify = deliveredOrders.filter(o => !verifiedOrderIds.has(o.id));
      
      console.log(`Filtered to ${ordersToVerify.length} unverified orders out of ${deliveredOrders.length}`);
    }

    if (ordersToVerify.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'All PostEx orders in this batch already verified',
          verified: 0,
          downgraded: 0,
          skipped: deliveredOrders.length
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Verifying ${ordersToVerify.length} PostEx orders...`);

    let verifiedCount = 0;
    let downgradedCount = 0;
    let errorCount = 0;
    const downgradedOrders: any[] = [];
    const errors: any[] = [];

    for (const order of ordersToVerify) {
      try {
        console.log(`Checking ${order.order_number} (${order.tracking_id})`);

        // Call courier tracking
        const { data: trackingData, error: trackingError } = await supabaseAdmin.functions.invoke(
          'courier-tracking',
          {
            body: {
              trackingId: order.tracking_id,
              courierCode: 'postex'
            }
          }
        );

        if (trackingError || !trackingData || !trackingData.success) {
          console.error(`Tracking error for ${order.order_number}:`, trackingError || trackingData?.error);
          errorCount++;
          errors.push({ 
            order_number: order.order_number, 
            tracking_id: order.tracking_id,
            error: trackingError?.message || trackingData?.error || 'Unknown error'
          });
          continue;
        }

        // courier-tracking returns { success: true, tracking: { status: '...', statusHistory: [...], ... } }
        const tracking = trackingData.tracking || {};
        const courierStatus = (tracking.status || '').toLowerCase();
        console.log(`${order.order_number}: PostEx status = "${courierStatus}"`);
        
        const isActuallyDelivered = 
          courierStatus.includes('delivered') || 
          courierStatus.includes('complete') ||
          courierStatus.includes('received');

        if (isActuallyDelivered) {
          // Extract actual delivery timestamp from PostEx tracking history
          const statusHistory = tracking.statusHistory || [];
          const deliveredEvent = statusHistory.find((event: any) => 
            event.status === 'delivered' || 
            (event.message || '').toLowerCase().includes('delivered')
          );
          
          // Use PostEx's updatedAt timestamp as the actual delivery date
          let actualDeliveryDate = deliveredEvent?.timestamp || deliveredEvent?.raw?.updatedAt;
          
          if (actualDeliveryDate && actualDeliveryDate !== order.delivered_at) {
            console.log(`Updating ${order.order_number} delivered_at from ${order.delivered_at} to ${actualDeliveryDate}`);
            
            const { error: updateError } = await supabaseAdmin
              .from('orders')
              .update({ delivered_at: actualDeliveryDate })
              .eq('id', order.id);
            
            if (updateError) {
              console.error(`Failed to update delivered_at for ${order.order_number}:`, updateError);
            }
          }
          
          verifiedCount++;
          console.log(`✓ ${order.order_number} confirmed delivered (actual date: ${actualDeliveryDate || order.delivered_at})`);
        } else {
          // NOT delivered according to PostEx - downgrade
          let newStatus = 'dispatched';
          
          if (courierStatus.includes('transit') || courierStatus.includes('in transit')) {
            newStatus = 'dispatched';
          } else if (courierStatus.includes('booked') || courierStatus.includes('picked')) {
            newStatus = 'booked';
          } else if (courierStatus.includes('return') || courierStatus.includes('rto')) {
            newStatus = 'returned';
          } else if (courierStatus.includes('cancel')) {
            newStatus = 'cancelled';
          }

          console.log(`✗ ${order.order_number} NOT delivered (PostEx: ${courierStatus}), downgrading to ${newStatus}`);

          // Update order status
          const currentTags = order.tags || [];
          const updatedTags = currentTags.map((tag: string) => 
            tag === 'Ecomnet - Delivered' ? `Ecomnet - ${newStatus.charAt(0).toUpperCase() + newStatus.slice(1)}` : tag
          );

          const { error: updateError } = await supabaseAdmin
            .from('orders')
            .update({
              status: newStatus,
              tags: updatedTags,
              delivered_at: null,
            })
            .eq('id', order.id);

          if (updateError) {
            console.error(`Update error for ${order.order_number}:`, updateError);
            errorCount++;
            errors.push({ order_number: order.order_number, error: updateError.message });
            continue;
          }

          // Log the correction
          await supabaseAdmin
            .from('activity_logs')
            .insert({
              action: 'postex_verification_downgrade',
              entity_type: 'order',
              entity_id: order.id,
              details: {
                order_number: order.order_number,
                previous_status: 'delivered',
                new_status: newStatus,
                courier_status: courierStatus,
                tracking_id: order.tracking_id,
                reason: 'PostEx API verification - order not actually delivered'
              },
              user_id: '00000000-0000-0000-0000-000000000000',
            });

          downgradedCount++;
          downgradedOrders.push({
            order_number: order.order_number,
            tracking_id: order.tracking_id,
            postex_status: courierStatus,
            new_status: newStatus
          });
        }

        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 200));

      } catch (orderError: any) {
        console.error(`Exception for ${order.order_number}:`, orderError);
        errorCount++;
        errors.push({ order_number: order.order_number, error: orderError.message });
      }
    }

    console.log(`PostEx verification complete: ${verifiedCount} confirmed, ${downgradedCount} downgraded, ${errorCount} errors`);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Verified ${ordersToVerify.length} PostEx orders`,
        processed: ordersToVerify.length,
        verified: verifiedCount,
        downgraded: downgradedCount,
        errors: errorCount,
        downgradedOrders: downgradedOrders.length > 0 ? downgradedOrders : undefined,
        errorDetails: errors.length > 0 ? errors : undefined,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('Error in verify-postex-orders:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
