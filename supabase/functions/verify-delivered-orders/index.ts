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

    // Get batch size from request body (default 50, max 100)
    const { batchSize = 50 } = await req.json().catch(() => ({}));
    const limit = Math.min(Math.max(batchSize, 1), 100);

    console.log(`Starting verification of delivered orders (batch size: ${limit})...`);

    // Get delivered orders with tracking IDs and courier assigned (limited batch)
    const { data: deliveredOrders, error: fetchError } = await supabaseAdmin
      .from('orders')
      .select('id, order_number, status, courier, tracking_id, tags')
      .eq('status', 'delivered')
      .not('tracking_id', 'is', null)
      .not('courier', 'is', null)
      .order('delivered_at', { ascending: false, nullsFirst: false })
      .limit(limit);

    if (fetchError) {
      console.error('Error fetching delivered orders:', fetchError);
      throw fetchError;
    }

    if (!deliveredOrders || deliveredOrders.length === 0) {
      console.log('No delivered orders found to verify');
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'No more delivered orders to verify',
          verified: 0,
          downgraded: 0,
          batchSize: limit
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Processing batch of ${deliveredOrders.length} delivered orders...`);

    let verifiedCount = 0;
    let downgradedCount = 0;
    let errorCount = 0;
    const errors: any[] = [];
    const downgradedOrders: any[] = [];

    for (const order of deliveredOrders) {
      try {
        // Skip if no tracking ID or courier
        if (!order.tracking_id || !order.courier) {
          continue;
        }

        console.log(`Verifying order ${order.order_number} with ${order.courier}`);

        // Call courier tracking API
        const { data: trackingData, error: trackingError } = await supabaseAdmin.functions.invoke(
          'courier-tracking',
          {
            body: {
              trackingId: order.tracking_id,
              courierName: order.courier
            }
          }
        );

        if (trackingError) {
          console.error(`Tracking error for ${order.order_number}:`, trackingError);
          errorCount++;
          errors.push({ 
            order_number: order.order_number, 
            error: trackingError.message 
          });
          continue;
        }

        if (!trackingData || trackingData.error) {
          console.error(`Invalid tracking response for ${order.order_number}:`, trackingData?.error);
          errorCount++;
          errors.push({ 
            order_number: order.order_number, 
            error: trackingData?.error || 'Invalid tracking response' 
          });
          continue;
        }

        // Check if courier status indicates delivery
        const courierStatus = trackingData.status?.toLowerCase() || '';
        const isActuallyDelivered = 
          courierStatus.includes('delivered') || 
          courierStatus.includes('complete') ||
          courierStatus.includes('received');

        if (isActuallyDelivered) {
          // Order is correctly marked as delivered
          verifiedCount++;
          console.log(`✓ Order ${order.order_number} correctly delivered`);
        } else {
          // Order should NOT be marked as delivered - downgrade it
          let newStatus = 'dispatched';
          
          // Determine appropriate status based on courier status
          if (courierStatus.includes('transit') || courierStatus.includes('in transit')) {
            newStatus = 'dispatched';
          } else if (courierStatus.includes('booked') || courierStatus.includes('picked')) {
            newStatus = 'booked';
          } else if (courierStatus.includes('return') || courierStatus.includes('rto')) {
            newStatus = 'returned';
          } else if (courierStatus.includes('cancel')) {
            newStatus = 'cancelled';
          }

          console.log(`✗ Order ${order.order_number} NOT delivered (courier says: ${courierStatus}), downgrading to ${newStatus}`);

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
            console.error(`Error updating order ${order.order_number}:`, updateError);
            errorCount++;
            errors.push({ order_number: order.order_number, error: updateError.message });
            continue;
          }

          // Log the correction
          await supabaseAdmin
            .from('activity_logs')
            .insert({
              action: 'order_status_corrected',
              entity_type: 'order',
              entity_id: order.id,
              details: {
                order_number: order.order_number,
                previous_status: 'delivered',
                new_status: newStatus,
                reason: 'Courier API verification failed - order not actually delivered',
                courier: order.courier,
                courier_status: courierStatus,
                tracking_id: order.tracking_id,
              },
              user_id: '00000000-0000-0000-0000-000000000000', // System user
            });

          downgradedCount++;
          downgradedOrders.push({
            order_number: order.order_number,
            courier: order.courier,
            courier_status: courierStatus,
            new_status: newStatus
          });
        }

      } catch (orderError: any) {
        console.error(`Exception verifying order ${order.order_number}:`, orderError);
        errorCount++;
        errors.push({ order_number: order.order_number, error: orderError.message });
      }
    }

    console.log(`Verification complete: ${verifiedCount} correct, ${downgradedCount} downgraded, ${errorCount} errors`);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Processed batch of ${deliveredOrders.length} orders`,
        batchSize: limit,
        processed: deliveredOrders.length,
        verified: verifiedCount,
        downgraded: downgradedCount,
        errors: errorCount,
        hasMore: deliveredOrders.length === limit,
        downgradedOrders: downgradedOrders.length > 0 ? downgradedOrders : undefined,
        errorDetails: errors.length > 0 ? errors : undefined,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('Error in verify-delivered-orders:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
