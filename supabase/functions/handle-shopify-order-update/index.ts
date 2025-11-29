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
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { order, userId } = await req.json();

    if (!order || !order.id) {
      return new Response(
        JSON.stringify({ error: 'Invalid order data' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Processing Shopify order update: ${order.id}`);

    // Check if order exists
    const { data: existingOrder } = await supabase
      .from('orders')
      .select('id, status')
      .eq('shopify_order_id', order.id.toString())
      .single();

    const isNewOrder = !existingOrder;
    const orderData: any = {
      shopify_order_id: order.id.toString(),
      shopify_order_number: order.order_number?.toString() || order.name,
      order_number: order.order_number?.toString() || order.name,
      customer_name: order.customer?.first_name && order.customer?.last_name
        ? `${order.customer.first_name} ${order.customer.last_name}`
        : order.customer?.first_name || 'Unknown',
      customer_email: order.customer?.email || null,
      customer_phone: order.customer?.phone || order.shipping_address?.phone || null,
      customer_address: order.shipping_address?.address1 || null,
      total_amount: parseFloat(order.total_price || '0'),
      items: order.line_items || [],
      status: 'pending',
      last_shopify_sync: new Date().toISOString(),
    };

    let orderId = existingOrder?.id;

    if (isNewOrder) {
      // Insert new order
      const { data: newOrder, error: insertError } = await supabase
        .from('orders')
        .insert(orderData)
        .select('id')
        .single();

      if (insertError) throw insertError;
      orderId = newOrder.id;

      console.log(`Created new order: ${orderId}`);

      // Log order creation activity
      await supabase
        .from('activity_logs')
        .insert({
          action: 'order_created',
          entity_type: 'order',
          entity_id: orderId,
          details: {
            shopify_order_id: order.id,
            order_number: orderData.order_number,
            customer_name: orderData.customer_name,
            total_amount: orderData.total_amount,
            source: 'shopify_webhook',
          },
          user_id: userId || '00000000-0000-0000-0000-000000000000', // System user
        });
    } else {
      // Update existing order
      const { error: updateError } = await supabase
        .from('orders')
        .update(orderData)
        .eq('id', orderId);

      if (updateError) throw updateError;

      console.log(`Updated existing order: ${orderId}`);

      // Log order update activity
      await supabase
        .from('activity_logs')
        .insert({
          action: 'order_updated',
          entity_type: 'order',
          entity_id: orderId,
          details: {
            shopify_order_id: order.id,
            order_number: orderData.order_number,
            customer_name: orderData.customer_name,
            previous_status: existingOrder.status,
            source: 'shopify_webhook',
          },
          user_id: userId || '00000000-0000-0000-0000-000000000000', // System user
        });
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        orderId, 
        isNewOrder,
        message: isNewOrder ? 'Order created' : 'Order updated'
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('Error handling Shopify order update:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
