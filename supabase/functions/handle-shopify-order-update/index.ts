import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.2';
import { createHmac } from 'https://deno.land/std@0.177.0/node/crypto.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-shopify-hmac-sha256, x-shopify-topic, x-shopify-shop-domain',
};

function verifyWebhook(body: string, hmacHeader: string, secret: string): boolean {
  const hash = createHmac('sha256', secret)
    .update(body, 'utf8')
    .digest('base64');
  return hash === hmacHeader;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get webhook headers
    const hmacHeader = req.headers.get('x-shopify-hmac-sha256');
    const topic = req.headers.get('x-shopify-topic');
    const shopDomain = req.headers.get('x-shopify-shop-domain');

    // Get body as text for HMAC verification
    const bodyText = await req.text();

    // Verify webhook signature
    const webhookSecret = Deno.env.get('SHOPIFY_WEBHOOK_SECRET');
    if (webhookSecret && hmacHeader) {
      const isValid = verifyWebhook(bodyText, hmacHeader, webhookSecret);
      if (!isValid) {
        console.error('Invalid webhook signature');
        return new Response(JSON.stringify({ error: 'Invalid signature' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    const order = JSON.parse(bodyText);
    console.log(`Received webhook: ${topic} for order ${order.id}`);

    // Update webhook registry last triggered time
    await supabase
      .from('shopify_webhook_registry')
      .update({ last_triggered: new Date().toISOString() })
      .eq('topic', topic || 'orders/updated');

    // Find the order in our database by Shopify order ID
    const { data: existingOrder, error: findError } = await supabase
      .from('orders')
      .select('id')
      .eq('shopify_order_id', order.id.toString())
      .single();

    if (findError || !existingOrder) {
      console.log(`Order not found in database for Shopify ID ${order.id}`);
      return new Response(JSON.stringify({ success: true, message: 'Order not found' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Map Shopify status to our status
    let newStatus = 'pending';
    if (order.cancelled_at) {
      newStatus = 'cancelled';
    } else if (order.fulfillment_status === 'fulfilled') {
      newStatus = 'delivered';
    } else if (order.fulfillment_status === 'partial') {
      newStatus = 'dispatched';
    } else if (order.financial_status === 'paid') {
      newStatus = 'processing';
    }

    // Extract tracking info
    let trackingId = null;
    if (order.fulfillments && order.fulfillments.length > 0) {
      const fulfillment = order.fulfillments[0];
      if (fulfillment.tracking_number) {
        trackingId = fulfillment.tracking_number;
      }
    }

    // Update order in our database
    const updateData: any = {
      status: newStatus,
      last_shopify_sync: new Date().toISOString(),
    };

    if (trackingId) {
      updateData.tracking_id = trackingId;
    }

    if (order.cancelled_at) {
      updateData.notes = `Order cancelled in Shopify at ${order.cancelled_at}. Reason: ${order.cancel_reason || 'Not specified'}`;
    }

    await supabase
      .from('orders')
      .update(updateData)
      .eq('id', existingOrder.id);

    console.log(`Updated order ${existingOrder.id} with status: ${newStatus}`);

    // Log the sync
    await supabase.from('shopify_sync_log').insert({
      sync_type: 'order_update_webhook',
      status: 'success',
      records_processed: 1,
      details: {
        shopify_order_id: order.id,
        local_order_id: existingOrder.id,
        topic,
        new_status: newStatus,
      },
    });

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error handling order update webhook:', error);
    
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