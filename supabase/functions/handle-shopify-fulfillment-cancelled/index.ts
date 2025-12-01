import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.2';
import { createHmac } from 'https://deno.land/std@0.177.0/node/crypto.ts';

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

    // Verify Shopify webhook signature
    const hmacHeader = req.headers.get('X-Shopify-Hmac-Sha256');
    const shopifySecret = Deno.env.get('SHOPIFY_WEBHOOK_SECRET');

    if (!hmacHeader || !shopifySecret) {
      console.error('Missing HMAC header or webhook secret');
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = await req.text();
    const hash = createHmac('sha256', shopifySecret).update(body).digest('base64');

    if (hash !== hmacHeader) {
      console.error('Invalid webhook signature');
      return new Response(JSON.stringify({ error: 'Invalid signature' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Parse fulfillment payload
    const fulfillment = JSON.parse(body);
    console.log('Received fulfillment webhook:', fulfillment.id, 'Status:', fulfillment.status);

    // Only process cancelled fulfillments
    if (fulfillment.status !== 'cancelled') {
      console.log('Fulfillment not cancelled, ignoring');
      return new Response(JSON.stringify({ message: 'Not a cancellation' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get Shopify order ID from fulfillment
    const shopifyOrderId = fulfillment.order_id?.toString();
    if (!shopifyOrderId) {
      console.error('No order_id in fulfillment payload');
      return new Response(JSON.stringify({ error: 'Missing order_id' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`Processing cancelled fulfillment for Shopify order ${shopifyOrderId}`);

    // Find order in ERP
    const { data: order, error: orderError } = await supabaseAdmin
      .from('orders')
      .select('id, status, courier, tracking_id, order_number, booked_at')
      .eq('shopify_order_id', shopifyOrderId)
      .single();

    if (orderError || !order) {
      console.error('Order not found in ERP:', shopifyOrderId);
      return new Response(JSON.stringify({ error: 'Order not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`Found order in ERP: ${order.order_number}, current status: ${order.status}`);

    // Safety check: Don't touch orders that were manually dispatched
    const { data: hasDispatch } = await supabaseAdmin
      .from('dispatches')
      .select('id')
      .eq('order_id', order.id)
      .single();

    if (hasDispatch) {
      console.log('Order has dispatch record - protected from downgrade');
      return new Response(JSON.stringify({ 
        message: 'Order manually dispatched, skipping downgrade',
        order_number: order.order_number 
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Safety check: Only downgrade if status allows it
    const allowedStatuses = ['pending', 'confirmed', 'booked'];
    if (!allowedStatuses.includes(order.status)) {
      console.log(`Order status ${order.status} cannot be downgraded`);
      return new Response(JSON.stringify({ 
        message: 'Order status does not allow downgrade',
        order_number: order.order_number,
        current_status: order.status
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Store previous state for logging
    const previousState = {
      status: order.status,
      courier: order.courier,
      tracking_id: order.tracking_id,
      booked_at: order.booked_at,
    };

    // Downgrade the order
    const { error: updateError } = await supabaseAdmin
      .from('orders')
      .update({
        status: 'pending',
        courier: null,
        tracking_id: null,
        booked_at: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', order.id);

    if (updateError) {
      console.error('Failed to update order:', updateError);
      return new Response(JSON.stringify({ error: 'Failed to update order' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`✓ Downgraded order ${order.order_number} from ${previousState.status} to pending`);

    // Log activity for audit trail
    await supabaseAdmin
      .from('activity_logs')
      .insert({
        action: 'fulfillment_cancelled',
        entity_type: 'order',
        entity_id: order.id,
        details: {
          order_number: order.order_number,
          previous_status: previousState.status,
          previous_courier: previousState.courier,
          previous_tracking: previousState.tracking_id,
          previous_booked_at: previousState.booked_at,
          shopify_order_id: shopifyOrderId,
          shopify_fulfillment_id: fulfillment.id,
          reason: 'Shopify fulfillment cancelled',
          source: 'shopify_fulfillment_webhook',
          timestamp: new Date().toISOString(),
        },
        user_id: '00000000-0000-0000-0000-000000000000', // System user
      });

    return new Response(JSON.stringify({
      success: true,
      message: 'Order downgraded successfully',
      order_number: order.order_number,
      previous_status: previousState.status,
      new_status: 'pending',
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error processing fulfillment cancellation:', error);
    
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
