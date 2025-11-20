import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.2';
import { getEcomnetStatusTag } from '../_shared/ecomnetStatusTags.ts';

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

    console.log('Starting Ecomnet tag backfill process...');

    // Fetch all orders that don't have an Ecomnet tag
    const { data: orders, error: fetchError } = await supabase
      .from('orders')
      .select('id, order_number, status, tags, shopify_order_id')
      .or('tags.is.null,tags.cs.{}')
      .not('shopify_order_id', 'is', null);

    if (fetchError) {
      console.error('Error fetching orders:', fetchError);
      throw fetchError;
    }

    if (!orders || orders.length === 0) {
      console.log('No orders found without Ecomnet tags');
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'No orders need backfilling',
          processed: 0 
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Found ${orders.length} orders without Ecomnet tags`);

    let processed = 0;
    let failed = 0;
    const errors: string[] = [];

    // Process in batches of 50
    const batchSize = 50;
    for (let i = 0; i < orders.length; i += batchSize) {
      const batch = orders.slice(i, i + batchSize);
      
      for (const order of batch) {
        try {
          // Get the current status
          const currentStatus = order.status || 'pending';
          const ecomnetTag = getEcomnetStatusTag(currentStatus);
          
          // Get existing tags (handle both array and null cases)
          const existingTags = Array.isArray(order.tags) ? order.tags : [];
          
          // Check if Ecomnet tag already exists
          const hasEcomnetTag = existingTags.some(tag => tag.startsWith('Ecomnet - '));
          
          if (hasEcomnetTag) {
            console.log(`Order ${order.order_number} already has Ecomnet tag, skipping`);
            continue;
          }
          
          // Add Ecomnet tag
          const updatedTags = [...existingTags, ecomnetTag];
          
          // Update local order
          const { error: updateError } = await supabase
            .from('orders')
            .update({ tags: updatedTags })
            .eq('id', order.id);
          
          if (updateError) {
            console.error(`Error updating order ${order.order_number}:`, updateError);
            errors.push(`${order.order_number}: ${updateError.message}`);
            failed++;
            continue;
          }
          
          // Queue sync to Shopify
          if (order.shopify_order_id) {
            const { error: queueError } = await supabase
              .from('sync_queue')
              .insert({
                entity_type: 'order',
                entity_id: order.id,
                action: 'update',
                direction: 'to_shopify',
                priority: 'normal',
                payload: {
                  shopify_order_id: order.shopify_order_id,
                  changes: {
                    tags: updatedTags
                  }
                },
                status: 'pending'
              });
            
            if (queueError) {
              console.error(`Error queuing sync for ${order.order_number}:`, queueError);
              // Don't count as failed since local update succeeded
            }
          }
          
          processed++;
          console.log(`✓ Processed ${order.order_number}: Added ${ecomnetTag}`);
          
        } catch (err) {
          console.error(`Error processing order ${order.order_number}:`, err);
          errors.push(`${order.order_number}: ${err.message}`);
          failed++;
        }
      }
      
      // Small delay between batches
      if (i + batchSize < orders.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    const summary = {
      success: true,
      total_orders: orders.length,
      processed,
      failed,
      errors: errors.length > 0 ? errors.slice(0, 10) : undefined, // Only return first 10 errors
    };

    console.log('Backfill complete:', summary);

    return new Response(
      JSON.stringify(summary),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in backfill process:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message,
        stack: error.stack 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
