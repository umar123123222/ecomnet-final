import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { entry, courierId, courierName, courierCode, userId } = await req.json();

    if (!entry || !userId) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const startTime = Date.now();

    // OPTIMIZED: Single query with OR to find order by tracking_id OR order_number
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('id, tracking_id, order_number, customer_name, total_amount, courier, status')
      .or(`tracking_id.eq.${entry},order_number.eq.${entry},order_number.eq.SHOP-${entry},order_number.ilike.%${entry}%,shopify_order_number.eq.${entry}`)
      .limit(1)
      .maybeSingle();

    if (!order) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Order not found',
          processingTime: Date.now() - startTime
        }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Determine match type
    const matchType = order.tracking_id === entry ? 'tracking_id' : 'order_number';

    // Determine courier
    let finalCourierId = courierId;
    let finalCourierName = courierName;
    let finalCourierCode = courierCode;

    if (order.courier) {
      // Order already has courier - use that
      const { data: existingCourier } = await supabase
        .from('couriers')
        .select('id, name, code')
        .eq('code', order.courier)
        .maybeSingle();

      if (existingCourier) {
        finalCourierId = existingCourier.id;
        finalCourierName = existingCourier.name;
        finalCourierCode = existingCourier.code;
      } else {
        finalCourierName = order.courier;
        finalCourierCode = order.courier;
      }
    }

    if (!finalCourierName) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'No courier assigned',
          order: { order_number: order.order_number, customer_name: order.customer_name },
          processingTime: Date.now() - startTime
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if already dispatched
    const { data: existingDispatch } = await supabase
      .from('dispatches')
      .select('id')
      .eq('order_id', order.id)
      .maybeSingle();

    if (existingDispatch) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Already dispatched',
          order: { order_number: order.order_number, customer_name: order.customer_name },
          processingTime: Date.now() - startTime
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const trackingId = matchType === 'tracking_id' ? entry : order.tracking_id;
    const now = new Date().toISOString();

    // Update tracking ID if needed
    if (matchType === 'tracking_id' && entry !== order.tracking_id) {
      await supabase
        .from('orders')
        .update({ tracking_id: entry })
        .eq('id', order.id);
    }

    // ATOMIC: Insert dispatch
    const { error: dispatchError } = await supabase
      .from('dispatches')
      .insert({
        order_id: order.id,
        tracking_id: trackingId,
        courier: finalCourierName,
        courier_id: finalCourierId,
        dispatch_date: now,
        dispatched_by: userId
      });

    if (dispatchError) {
      console.error('Dispatch insert error:', dispatchError);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: dispatchError.message,
          processingTime: Date.now() - startTime
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Update order status
    const orderUpdate: any = {
      status: 'dispatched',
      dispatched_at: now
    };

    if (!order.courier && finalCourierCode) {
      orderUpdate.courier = finalCourierCode;
    }

    const { error: orderUpdateError } = await supabase
      .from('orders')
      .update(orderUpdate)
      .eq('id', order.id);

    if (orderUpdateError) {
      console.error('Order update error:', orderUpdateError);
    }

    const processingTime = Date.now() - startTime;

    // Return success with minimal data
    return new Response(
      JSON.stringify({
        success: true,
        order: {
          order_number: order.order_number,
          customer_name: order.customer_name,
          total_amount: order.total_amount
        },
        courier: finalCourierName,
        tracking_id: trackingId,
        matchType,
        processingTime
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Rapid dispatch error:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
