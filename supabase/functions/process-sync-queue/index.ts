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

    const batchSize = 25; // Reduced to prevent resource exhaustion
    let processed = 0;
    let failed = 0;
    const results: any[] = [];

    // Priority-based processing: fetch items ordered by priority
    const { data: queueItems, error: queueError } = await supabase
      .from('sync_queue')
      .select('*')
      .eq('status', 'pending')
      .lt('retry_count', 5)
      // Process by priority (critical > high > normal > low), then by created_at
      .order('priority', { ascending: false })
      .order('created_at', { ascending: false })
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
    console.log('Fetched sync_queue items:', queueItems.map((i: any) => ({
      id: i.id,
      status: i.status,
      entity_type: i.entity_type,
      direction: i.direction,
      action: i.action,
      retry_count: i.retry_count,
      created_at: i.created_at,
    })));

    // Process each item with delay to prevent rate limiting
    for (let i = 0; i < queueItems.length; i++) {
      const item = queueItems[i];
      
      // Add delay between items (exponential backoff based on retry count)
      if (i > 0) {
        const baseDelay = 500; // 500ms base delay
        const retryMultiplier = Math.pow(2, item.retry_count); // Exponential backoff
        const delay = Math.min(baseDelay * retryMultiplier, 5000); // Max 5 seconds
        await new Promise(resolve => setTimeout(resolve, delay));
      }
      
      try {
        // Mark as processing
        await supabase
          .from('sync_queue')
          .update({ status: 'processing' })
          .eq('id', item.id);

        let result;
        
        // Route to appropriate handler based on entity type and action
        if (item.entity_type === 'order' && item.direction === 'to_shopify') {
          console.log('Processing order sync_queue item:', {
            queue_id: item.id,
            order_id: item.entity_id,
            action: item.action,
            status: item.status,
          });

          if (item.action === 'create') {
            result = await supabase.functions.invoke('create-shopify-order', {
              body: { order_id: item.entity_id },
            });
        } else if (item.action === 'update') {
          // Fetch order data first to get current state
          const { data: orderData, error: orderError } = await supabase
            .from('orders')
            .select('shopify_order_id, status, tags, tracking_id, customer_address, customer_new_address, city, customer_name, customer_phone, notes, cancellation_reason')
            .eq('id', item.entity_id)
            .single();

          console.log('Order data for Shopify update:', {
            queue_id: item.id,
            order_id: item.entity_id,
            shopify_order_id: orderData?.shopify_order_id,
            current_tags: orderData?.tags,
            changes: item.payload?.changes,
          });

          // Skip orders missing shopify_order_id (can't sync to Shopify)
          if (orderError || !orderData?.shopify_order_id) {
            console.warn(
              `Skipping queue item ${item.id}: order ${item.entity_id} missing shopify_order_id or not found`
            );

            await supabase
              .from('sync_queue')
              .update({
                status: 'failed',
                retry_count: 5, // Mark as permanently failed
                error_message: 'Missing shopify_order_id or order not found'
              })
              .eq('id', item.id);

            failed++;
            results.push({
              id: item.id,
              status: 'failed',
              error: 'Missing shopify_order_id or order not found',
              retry_count: 5
            });

            continue; // Skip to next item
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
            customer_phone: orderData.customer_phone,
            cancellation_reason: orderData.cancellation_reason
          };
          
          // Handle tracking update if tracking_id changed
          if (changes.tracking_id) {
            console.log('Calling update-shopify-order for tracking update:', {
              order_id: item.entity_id,
              tracking_id: changes.tracking_id,
              tracking_company: changes.tracking_company,
              courier: changes.courier
            });

            const trackingResult = await supabase.functions.invoke('update-shopify-order', {
              body: {
                order_id: item.entity_id,
                action: 'update_tracking',
                data: {
                  tracking_number: changes.tracking_id,
                  tracking_company: changes.tracking_company || changes.courier || 'Custom',
                  notify_customer: false
                }
              }
            });

            if (trackingResult.error) {
              console.error('Failed to update tracking in Shopify:', trackingResult.error);
              throw trackingResult.error;
            }
          }
          
          // Handle tags update FIRST (status change or explicit tags)
          // This ensures the tag is added before attempting to cancel
          let tagsToUpdate: string[] | null = null;
          
          if (changes.tags) {
            // Explicit tags provided
            tagsToUpdate = changes.tags;
          } else if (changes.status) {
            // Generate status tag using shared utility
            const { updateEcomnetStatusTag } = await import('../_shared/ecomnetStatusTags.ts');
            const existingTags = orderData.tags || [];
            tagsToUpdate = updateEcomnetStatusTag(existingTags, changes.status);
          }
          
          if (tagsToUpdate) {
            console.log('Calling update-shopify-order for tags update:', {
              order_id: item.entity_id,
              tags: tagsToUpdate
            });

            const tagsResult = await supabase.functions.invoke('update-shopify-order', {
              body: {
                order_id: item.entity_id,
                action: 'update_tags',
                data: { tags: tagsToUpdate }
              }
            });

            if (tagsResult.error) {
              console.error('Failed to update tags in Shopify:', tagsResult.error);
              throw tagsResult.error;
            }
            
            console.log('Successfully updated tags in Shopify');
          }
          
          // Handle order cancellation AFTER tags are updated
          if (changes.status === 'cancelled') {
            console.log('Processing cancellation for order:', item.entity_id);
            
            const cancelResult = await supabase.functions.invoke('update-shopify-order', {
              body: {
                order_id: item.entity_id,
                action: 'cancel_order',
                data: {
                  reason: changes.cancellation_reason || 'other',
                  notify_customer: false,
                  restock: false
                }
              }
            });

            if (cancelResult.error) {
              console.error('Failed to cancel order in Shopify:', cancelResult.error);
              throw cancelResult.error;
            }
            
            console.log('Successfully cancelled order in Shopify');
          }
          
          // Handle address update ONLY if:
          // 1. Address fields changed
          // 2. It's a user change (not system/webhook)
          // 3. Not flagged to skip (didn't originate from Shopify webhook)
          const isUserChange = item.payload?.is_user_change === true;
          const skipAddressSync = item.payload?.skip_address_sync === true;
          const addressChanged = item.payload?.address_changed === true;
          
          if (addressChanged && (changes.customer_address || changes.customer_new_address || changes.city)) {
            if (skipAddressSync) {
              console.log('Skipping address sync - change originated from Shopify webhook');
            } else if (!isUserChange) {
              console.log('Skipping address sync - not a user-initiated change');
            } else {
              console.log('Calling update-shopify-order for address update (user-initiated)');
              
              // Get user name for attribution
              let userName = 'ERP User';
              const changedBy = item.payload?.changed_by;
              if (changedBy) {
                const { data: userProfile } = await supabase
                  .from('profiles')
                  .select('full_name')
                  .eq('id', changedBy)
                  .single();
                
                if (userProfile?.full_name) {
                  userName = userProfile.full_name;
                }
              }
              
              const addressResult = await supabase.functions.invoke('update-shopify-order', {
                body: {
                  order_id: item.entity_id,
                  action: 'update_address',
                  data: {
                    address: {
                      address1: changes.customer_address || changes.customer_new_address,
                      city: changes.city,
                      first_name: changes.customer_name?.split(' ')[0],
                      last_name: changes.customer_name?.split(' ').slice(1).join(' '),
                      phone: changes.customer_phone,
                    }
                  }
                }
              });

              if (addressResult.error) {
                console.error('Failed to update address in Shopify:', addressResult.error);
                throw addressResult.error;
              }
              
              // Add attribution note to Shopify order
              const timestamp = new Date().toLocaleString('en-PK', { timeZone: 'Asia/Karachi' });
              const attributionNote = `Address updated by ${userName} via ERP on ${timestamp}`;
              
              console.log('Adding address change attribution note:', attributionNote);
              
              const noteResult = await supabase.functions.invoke('update-shopify-order', {
                body: {
                  order_id: item.entity_id,
                  action: 'update_notes',
                  data: { note: attributionNote }
                }
              });

              if (noteResult.error) {
                console.warn('Failed to add attribution note (non-blocking):', noteResult.error);
                // Don't throw - this is non-critical
              }
            }
          }
          
          // Handle customer note update
          if (changes.notes) {
            console.log('Calling update-shopify-order for notes update');
            
            const notesResult = await supabase.functions.invoke('update-shopify-order', {
              body: {
                order_id: item.entity_id,
                action: 'update_customer',
                data: { customer_note: changes.notes }
              }
            });

            if (notesResult.error) {
              console.error('Failed to update notes in Shopify:', notesResult.error);
              throw notesResult.error;
            }
          }
          }
        } else if (item.entity_type === 'inventory' && item.direction === 'to_shopify') {
          result = await supabase.functions.invoke('sync-inventory-to-shopify', {
            body: { inventory_id: item.entity_id },
          });
        }

        // Check if invocation was successful
        if (result?.error) {
          console.error(`update-shopify-order returned error for queue item ${item.id}:`, JSON.stringify(result.error));
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