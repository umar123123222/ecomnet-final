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

    const batchSize = 10; // Process 10 items at a time
    let processed = 0;
    let failed = 0;
    const results: any[] = [];

    // Get pending items from sync queue (oldest first, with retry logic)
    const { data: queueItems, error: queueError } = await supabase
      .from('sync_queue')
      .select('*')
      .in('status', ['pending', 'failed'])
      .lt('retry_count', 5)
      .order('created_at', { ascending: true })
      .limit(batchSize);

    if (queueError) {
      throw queueError;
    }

    if (!queueItems || queueItems.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'No items to process',
          processed: 0,
          failed: 0
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Processing ${queueItems.length} sync queue items`);

    // Process each item
    for (const item of queueItems) {
      try {
        // Mark as processing
        await supabase
          .from('sync_queue')
          .update({ status: 'processing' })
          .eq('id', item.id);

        let result;
        
        // Route to appropriate handler based on entity type and action
        if (item.entity_type === 'order' && item.direction === 'to_shopify') {
          if (item.action === 'create') {
            result = await supabase.functions.invoke('create-shopify-order', {
              body: { order_id: item.entity_id },
            });
          } else if (item.action === 'update') {
            result = await supabase.functions.invoke('update-shopify-order', {
              body: { 
                order_id: item.entity_id,
                action: 'update_tracking' // or other update types
              },
            });
          }
        } else if (item.entity_type === 'inventory' && item.direction === 'to_shopify') {
          result = await supabase.functions.invoke('sync-inventory-to-shopify', {
            body: { inventory_id: item.entity_id },
          });
        }

        // Check if invocation was successful
        if (result?.error) {
          throw new Error(result.error.message || 'Function invocation failed');
        }

        const responseData = result?.data;

        if (responseData?.success) {
          // Mark as completed
          await supabase
            .from('sync_queue')
            .update({ 
              status: 'completed',
              processed_at: new Date().toISOString(),
              error_message: null,
            })
            .eq('id', item.id);

          processed++;
          results.push({ id: item.id, status: 'completed' });
        } else {
          throw new Error(responseData?.error || 'Unknown error');
        }

      } catch (error) {
        console.error(`Error processing sync queue item ${item.id}:`, error);
        
        const newRetryCount = item.retry_count + 1;
        const newStatus = newRetryCount >= 5 ? 'failed' : 'failed'; // Keep as failed for retry

        // Update with error
        await supabase
          .from('sync_queue')
          .update({ 
            status: newStatus,
            retry_count: newRetryCount,
            error_message: error.message,
          })
          .eq('id', item.id);

        failed++;
        results.push({ 
          id: item.id, 
          status: newStatus,
          error: error.message,
          retry_count: newRetryCount
        });
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        processed,
        failed,
        total: queueItems.length,
        results,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error processing sync queue:', error);
    
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