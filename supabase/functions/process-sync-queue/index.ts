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
          // Fetch order data first to get current state
          const { data: orderData, error: orderError } = await supabase
            .from('orders')
            .select('shopify_order_id, status, tags, tracking_id, customer_address, customer_new_address, city, customer_name, customer_phone, notes')
            .eq('id', item.entity_id)
            .single();

          if (orderError || !orderData?.shopify_order_id) {
            throw new Error(`Order not found or missing shopify_order_id: ${item.entity_id}`);
          }

          // Get changes from payload (new format) or construct from current order data (old format)
          const changes = item.payload?.changes || {
            status: orderData.status,
            tracking_id: orderData.tracking_id,
            customer_address: orderData.customer_address,
            customer_new_address: orderData.customer_new_address,
            city: orderData.city,
            tags: orderData.tags,
            notes: orderData.notes,
            customer_name: orderData.customer_name,
            customer_phone: orderData.customer_phone
          };
          
          // ALWAYS handle status tag if status is present
          let tagsToUpdate: string[] = [];
          
          if (changes.status) {
            // Generate status tag
            const statusTag = `Ecomnet - ${changes.status.charAt(0).toUpperCase() + changes.status.slice(1)}`;
            
            // Get existing tags and filter out old Ecomnet status tags
            const existingTags = orderData.tags || [];
            const filteredTags = existingTags.filter((tag: string) => 
              !tag.startsWith('Ecomnet - ')
            );
            
            // Add new status tag
            tagsToUpdate = [...filteredTags, statusTag];
          }
          
          // Determine update action priority
          let updateAction = 'update_tags'; // Default to tags if status changed
          let updateData: any = { tags: tagsToUpdate };
          
          // If tracking changed, prioritize that (but still update tags separately)
          if (changes.tracking_id) {
            updateAction = 'update_tracking';
            updateData = {
              tracking_number: changes.tracking_id,
              tracking_company: 'TCS', // Default, should be dynamic
              notify_customer: true
            };
            
            // Update tags in a separate call if status changed
            if (changes.status && tagsToUpdate.length > 0) {
              await supabase.functions.invoke('update-shopify-order', {
                body: { 
                  order_id: item.entity_id,
                  action: 'update_tags',
                  data: { tags: tagsToUpdate }
                }
              });
            }
          } else if (changes.customer_address || changes.customer_new_address || changes.city) {
            updateAction = 'update_address';
            updateData = {
              address: {
                address1: changes.customer_address || changes.customer_new_address,
                city: changes.city,
                first_name: changes.customer_name?.split(' ')[0],
                last_name: changes.customer_name?.split(' ').slice(1).join(' '),
                phone: changes.customer_phone,
              }
            };
            
            // Update tags separately if status changed
            if (changes.status && tagsToUpdate.length > 0) {
              await supabase.functions.invoke('update-shopify-order', {
                body: { 
                  order_id: item.entity_id,
                  action: 'update_tags',
                  data: { tags: tagsToUpdate }
                }
              });
            }
          } else if (changes.notes) {
            updateAction = 'update_customer';
            updateData = { customer_note: changes.notes };
            
            // Update tags separately if status changed
            if (changes.status && tagsToUpdate.length > 0) {
              await supabase.functions.invoke('update-shopify-order', {
                body: { 
                  order_id: item.entity_id,
                  action: 'update_tags',
                  data: { tags: tagsToUpdate }
                }
              });
            }
          }

          // Execute main update (if not tags-only)
          if (updateAction !== 'update_tags' || tagsToUpdate.length === 0) {
            result = await supabase.functions.invoke('update-shopify-order', {
              body: { 
                order_id: item.entity_id,
                action: updateAction,
                data: updateData
              },
            });
          } else {
            // For tags-only updates
            result = await supabase.functions.invoke('update-shopify-order', {
              body: { 
                order_id: item.entity_id,
                action: 'update_tags',
                data: { tags: tagsToUpdate }
              },
            });
          }
          }
        } else if (item.entity_type === 'inventory' && item.direction === 'to_shopify') {
          result = await supabase.functions.invoke('sync-inventory-to-shopify', {
            body: { inventory_id: item.entity_id },
          });
        }

        // Check if invocation was successful
        if (result?.error) {
          console.error('Edge function invocation error:', JSON.stringify(result.error));
          throw new Error(result.error.message || 'Function invocation failed');
        }

        const responseData = result?.data;
        console.log(`Response from edge function for item ${item.id}:`, JSON.stringify(responseData));

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
          const errorMsg = responseData?.error || responseData?.message || 'Unknown error';
          console.error(`Edge function returned error for item ${item.id}:`, errorMsg);
          throw new Error(errorMsg);
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