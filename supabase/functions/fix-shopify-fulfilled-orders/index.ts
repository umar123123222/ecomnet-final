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

    console.log('Starting fix for orders incorrectly marked as delivered...');

    // Find all orders that are marked 'delivered' but have no courier or tracking
    // These are likely orders that were auto-marked delivered due to Shopify fulfillment
    const { data: affectedOrders, error: fetchError } = await supabaseAdmin
      .from('orders')
      .select('id, order_number, status, tags, shopify_order_id')
      .eq('status', 'delivered')
      .is('courier', null)
      .is('tracking_id', null);

    if (fetchError) {
      console.error('Error fetching affected orders:', fetchError);
      throw fetchError;
    }

    if (!affectedOrders || affectedOrders.length === 0) {
      console.log('No affected orders found');
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'No orders need fixing',
          ordersFixed: 0 
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Found ${affectedOrders.length} orders to fix`);

    // Fix each order
    let successCount = 0;
    let errorCount = 0;
    const errors: any[] = [];

    for (const order of affectedOrders) {
      try {
        // Update status back to pending and add 'Shopify - Fulfilled' tag
        const currentTags = order.tags || [];
        const updatedTags = currentTags.includes('Shopify - Fulfilled') 
          ? currentTags 
          : [...currentTags, 'Shopify - Fulfilled'];

        // Also replace any 'Ecomnet - Delivered' tag with 'Ecomnet - Pending'
        const finalTags = updatedTags.map(tag => 
          tag === 'Ecomnet - Delivered' ? 'Ecomnet - Pending' : tag
        );

        const { error: updateError } = await supabaseAdmin
          .from('orders')
          .update({
            status: 'pending',
            tags: finalTags,
            delivered_at: null,
          })
          .eq('id', order.id);

        if (updateError) {
          console.error(`Error updating order ${order.order_number}:`, updateError);
          errorCount++;
          errors.push({ order_number: order.order_number, error: updateError.message });
          continue;
        }

        // Log the fix
        await supabaseAdmin
          .from('activity_logs')
          .insert({
            action: 'order_status_corrected',
            entity_type: 'order',
            entity_id: order.id,
            details: {
              order_number: order.order_number,
              previous_status: 'delivered',
              new_status: 'pending',
              reason: 'Fixed incorrect delivered status from Shopify fulfillment',
              shopify_fulfilled_tag_added: !currentTags.includes('Shopify - Fulfilled'),
            },
            user_id: '00000000-0000-0000-0000-000000000000', // System user
          });

        successCount++;
        console.log(`Fixed order ${order.order_number}`);
      } catch (orderError: any) {
        console.error(`Exception fixing order ${order.order_number}:`, orderError);
        errorCount++;
        errors.push({ order_number: order.order_number, error: orderError.message });
      }
    }

    console.log(`Fix complete: ${successCount} orders fixed, ${errorCount} errors`);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Fixed ${successCount} orders`,
        ordersFixed: successCount,
        totalFound: affectedOrders.length,
        errors: errorCount > 0 ? errors : undefined,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('Error in fix-shopify-fulfilled-orders:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
