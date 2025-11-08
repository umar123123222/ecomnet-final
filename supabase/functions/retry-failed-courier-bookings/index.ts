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
    console.log('[RETRY] Starting courier booking retry processor');
    
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get all pending retries that are due
    const { data: retryQueue, error: queueError } = await supabase
      .from('courier_booking_queue')
      .select(`
        *,
        orders!courier_booking_queue_order_id_fkey(
          id,
          order_number,
          customer_name,
          customer_phone,
          customer_address,
          city,
          total_amount,
          items
        ),
        couriers!courier_booking_queue_courier_id_fkey(
          id,
          code,
          name
        )
      `)
      .in('status', ['pending', 'retrying'])
      .lte('next_retry_at', new Date().toISOString())
      .lt('retry_count', 5);

    if (queueError) {
      throw queueError;
    }

    if (!retryQueue || retryQueue.length === 0) {
      console.log('[RETRY] No pending retries found');
      return new Response(
        JSON.stringify({ success: true, message: 'No pending retries', retriesProcessed: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[RETRY] Found ${retryQueue.length} bookings to retry`);

    const results = [];

    for (const queueItem of retryQueue) {
      try {
        const order = queueItem.orders;
        const courier = queueItem.couriers;

        if (!order || !courier) {
          console.error(`[RETRY] Missing order or courier data for queue item ${queueItem.id}`);
          continue;
        }

        console.log(`[RETRY] Attempting retry ${queueItem.retry_count + 1} for order ${order.order_number}`);

        // Get pickup address from settings
        const { data: settings } = await supabase
          .from('api_settings')
          .select('setting_key, setting_value')
          .in('setting_key', [
            'PICKUP_ADDRESS_NAME',
            'PICKUP_ADDRESS_PHONE',
            'PICKUP_ADDRESS_ADDRESS',
            'PICKUP_ADDRESS_CITY'
          ]);

        const getSettingValue = (key: string) => 
          settings?.find(s => s.setting_key === key)?.setting_value || '';

        // Calculate pieces and weight
        const items = order.items || [];
        const totalPieces = Array.isArray(items) ? items.reduce((sum: number, item: any) => sum + (item.quantity || 0), 0) : 1;
        const estimatedWeight = totalPieces * 1;

        // Call courier booking function
        const bookingResponse = await supabase.functions.invoke('courier-booking', {
          body: {
            orderId: order.id,
            courierId: courier.id,
            pickupAddress: {
              name: getSettingValue('PICKUP_ADDRESS_NAME'),
              phone: getSettingValue('PICKUP_ADDRESS_PHONE'),
              address: getSettingValue('PICKUP_ADDRESS_ADDRESS'),
              city: getSettingValue('PICKUP_ADDRESS_CITY')
            },
            deliveryAddress: {
              name: order.customer_name,
              phone: order.customer_phone,
              address: order.customer_address,
              city: order.city
            },
            weight: estimatedWeight,
            pieces: totalPieces,
            codAmount: order.total_amount,
            specialInstructions: ''
          }
        });

        if (bookingResponse.error) {
          throw bookingResponse.error;
        }

        const data = bookingResponse.data;

        if (data.success) {
          // Success - remove from queue
          await supabase
            .from('courier_booking_queue')
            .update({ status: 'success' })
            .eq('id', queueItem.id);

          console.log(`[RETRY] Success for order ${order.order_number} - Tracking: ${data.trackingId}`);
          
          results.push({
            orderId: order.id,
            orderNumber: order.order_number,
            status: 'success',
            trackingId: data.trackingId
          });
        } else {
          throw new Error(data.error || 'Booking failed');
        }

      } catch (retryError: any) {
        console.error(`[RETRY] Failed for queue item ${queueItem.id}:`, retryError.message);

        const newRetryCount = queueItem.retry_count + 1;
        
        if (newRetryCount >= queueItem.max_retries) {
          // Max retries reached - mark as failed
          await supabase
            .from('courier_booking_queue')
            .update({
              status: 'failed',
              retry_count: newRetryCount,
              last_error_message: retryError.message
            })
            .eq('id', queueItem.id);

          console.log(`[RETRY] Max retries reached for order ${queueItem.orders?.order_number}`);
          
          results.push({
            orderId: queueItem.order_id,
            orderNumber: queueItem.orders?.order_number,
            status: 'failed',
            error: 'Max retries reached'
          });
        } else {
          // Calculate exponential backoff: 5min, 15min, 1hr, 4hr, 24hr
          const backoffMinutes = [5, 15, 60, 240, 1440][newRetryCount] || 1440;
          const nextRetry = new Date(Date.now() + backoffMinutes * 60 * 1000);

          await supabase
            .from('courier_booking_queue')
            .update({
              status: 'retrying',
              retry_count: newRetryCount,
              next_retry_at: nextRetry.toISOString(),
              last_error_code: retryError.code || 'UNKNOWN_ERROR',
              last_error_message: retryError.message
            })
            .eq('id', queueItem.id);

          console.log(`[RETRY] Scheduled next retry for ${queueItem.orders?.order_number} at ${nextRetry.toISOString()}`);
          
          results.push({
            orderId: queueItem.order_id,
            orderNumber: queueItem.orders?.order_number,
            status: 'scheduled_retry',
            nextRetry: nextRetry.toISOString(),
            attempt: newRetryCount
          });
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `Processed ${retryQueue.length} retry attempts`,
        retriesProcessed: retryQueue.length,
        results
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error: any) {
    console.error('[RETRY] Error in retry processor:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});