import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Process orders in parallel for efficiency
const PARALLEL_BATCH_SIZE = 5; // Track 5 orders simultaneously

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const trigger = body.trigger || 'manual';
    const offset = body.offset || 0;
    const limit = Math.min(body.limit || 50, 50);
    
    console.log(`🌙 Starting nightly tracking update (trigger: ${trigger}, offset: ${offset}, limit: ${limit})...`);
    
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get orders that need tracking - PRIORITIZE never-tracked orders first
    // Also include orders without dispatch records (will auto-create)
    const { data: activeOrders, error: fetchError } = await supabase
      .from('orders')
      .select(`
        id,
        order_number,
        status,
        courier,
        tracking_id,
        booked_at,
        created_at
      `)
      .eq('status', 'dispatched')
      .not('tracking_id', 'is', null)
      .neq('tracking_id', '')
      .order('booked_at', { ascending: true, nullsFirst: true }) // Oldest first
      .range(offset, offset + limit - 1);

    if (fetchError) {
      console.error('Error fetching active orders:', fetchError);
      throw fetchError;
    }

    console.log(`📦 Found ${activeOrders?.length || 0} active orders with tracking to update`);

    const results = {
      total: activeOrders?.length || 0,
      updated: 0,
      delivered: 0,
      returned: 0,
      failed: 0,
      noChange: 0,
      dispatchesCreated: 0,
      errors: [] as any[]
    };

    // Process orders in parallel batches for efficiency
    for (let i = 0; i < (activeOrders?.length || 0); i += PARALLEL_BATCH_SIZE) {
      const batch = activeOrders!.slice(i, i + PARALLEL_BATCH_SIZE);
      
      const batchPromises = batch.map(async (order) => {
        try {
          console.log(`🔍 Tracking order ${order.order_number} - ${order.courier} - ${order.tracking_id}`);
          
          // First check if dispatch exists, create if missing
          const { data: existingDispatch } = await supabase
            .from('dispatches')
            .select('id, courier_id')
            .eq('order_id', order.id)
            .maybeSingle();
          
          let dispatchId = existingDispatch?.id;
          let courierId = existingDispatch?.courier_id;
          
          // Auto-create missing dispatch record
          if (!existingDispatch) {
            console.log(`📝 Creating missing dispatch for order ${order.order_number}`);
            
            // Get courier_id from couriers table
            const { data: courierData } = await supabase
              .from('couriers')
              .select('id')
              .eq('code', order.courier)
              .maybeSingle();
            
            courierId = courierData?.id;
            
            const { data: newDispatch, error: createError } = await supabase
              .from('dispatches')
              .insert({
                order_id: order.id,
                tracking_id: order.tracking_id,
                courier: order.courier || 'unknown',
                courier_id: courierId,
                dispatch_date: order.booked_at || order.created_at,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
              })
              .select('id')
              .single();
            
            if (createError) {
              console.error(`Failed to create dispatch for ${order.order_number}:`, createError);
            } else {
              dispatchId = newDispatch?.id;
              results.dispatchesCreated++;
              console.log(`✅ Created dispatch ${dispatchId} for order ${order.order_number}`);
            }
          }
          
          // Now track the order
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
          
          try {
            const { data: trackingData, error: trackingError } = await supabase.functions.invoke(
              'courier-tracking',
              {
                body: {
                  trackingId: order.tracking_id,
                  courierCode: order.courier
                }
              }
            );
            
            clearTimeout(timeoutId);

            if (trackingError) {
              console.error(`Failed to track ${order.tracking_id}:`, trackingError);
              results.failed++;
              results.errors.push({
                order_id: order.id,
                order_number: order.order_number,
                tracking_id: order.tracking_id,
                error: trackingError.message
              });
              return;
            }

            if (trackingData?.success && trackingData?.tracking) {
              const tracking = trackingData.tracking;
              
              // Update dispatch last_tracking_update
              if (dispatchId) {
                await supabase
                  .from('dispatches')
                  .update({ last_tracking_update: new Date().toISOString() })
                  .eq('id', dispatchId);
              }
              
              // Update order status based on tracking status
              if (tracking.status === 'delivered') {
                // Extract actual delivery timestamp from tracking history
                // IMPORTANT: Use the FIRST (earliest) delivered event, not the last
                let actualDeliveryDate = new Date().toISOString();
                
                // Try to get the actual delivery date from statusHistory
                if (tracking.statusHistory && Array.isArray(tracking.statusHistory)) {
                  // Filter all delivered events and sort by timestamp to get earliest
                  const deliveredEvents = tracking.statusHistory.filter(
                    (event: any) => event.status?.toLowerCase() === 'delivered'
                  );
                  
                  if (deliveredEvents.length > 0) {
                    // Sort by timestamp ascending and take the first (earliest)
                    deliveredEvents.sort((a: any, b: any) => {
                      const dateA = new Date(a.timestamp || 0).getTime();
                      const dateB = new Date(b.timestamp || 0).getTime();
                      return dateA - dateB;
                    });
                    
                    const firstDeliveredEvent = deliveredEvents[0];
                    if (firstDeliveredEvent?.timestamp) {
                      const parsed = new Date(firstDeliveredEvent.timestamp);
                      if (!isNaN(parsed.getTime())) {
                        actualDeliveryDate = parsed.toISOString();
                        console.log(`📅 Found ${deliveredEvents.length} delivered events, using earliest: ${actualDeliveryDate}`);
                      }
                    }
                  }
                }
                
                // Fallback: check raw tracking data for PostEx-specific fields
                if (tracking.rawData && actualDeliveryDate === new Date().toISOString()) {
                  const raw = tracking.rawData;
                  const candidate = raw.updatedAt || raw.transactionDateTime;
                  if (candidate) {
                    const parsed = new Date(candidate);
                    if (!isNaN(parsed.getTime())) {
                      actualDeliveryDate = parsed.toISOString();
                    }
                  }
                }
                
                console.log(`📅 Order ${order.order_number} actual delivery date: ${actualDeliveryDate}`);
                
                await supabase
                  .from('orders')
                  .update({
                    status: 'delivered',
                    delivered_at: actualDeliveryDate
                  })
                  .eq('id', order.id);
                
                results.delivered++;
                results.updated++;
                console.log(`✅ Order ${order.order_number} marked as DELIVERED at ${actualDeliveryDate}`);
                
              } else if (tracking.status === 'returned') {
                // Extract actual return timestamp from tracking history
                // IMPORTANT: Use the FIRST (earliest) returned event
                let actualReturnDate = new Date().toISOString();
                
                if (tracking.statusHistory && Array.isArray(tracking.statusHistory)) {
                  // Filter all returned events and sort by timestamp to get earliest
                  const returnedEvents = tracking.statusHistory.filter(
                    (event: any) => event.status?.toLowerCase() === 'returned'
                  );
                  
                  if (returnedEvents.length > 0) {
                    // Sort by timestamp ascending and take the first (earliest)
                    returnedEvents.sort((a: any, b: any) => {
                      const dateA = new Date(a.timestamp || 0).getTime();
                      const dateB = new Date(b.timestamp || 0).getTime();
                      return dateA - dateB;
                    });
                    
                    const firstReturnedEvent = returnedEvents[0];
                    if (firstReturnedEvent?.timestamp) {
                      const parsed = new Date(firstReturnedEvent.timestamp);
                      if (!isNaN(parsed.getTime())) {
                        actualReturnDate = parsed.toISOString();
                        console.log(`↩️ Found ${returnedEvents.length} returned events, using earliest: ${actualReturnDate}`);
                      }
                    }
                  }
                }
                
                // Fallback: check raw tracking data
                if (tracking.rawData && actualReturnDate === new Date().toISOString()) {
                  const raw = tracking.rawData;
                  const candidate = raw.updatedAt || raw.transactionDateTime;
                  if (candidate) {
                    const parsed = new Date(candidate);
                    if (!isNaN(parsed.getTime())) {
                      actualReturnDate = parsed.toISOString();
                    }
                  }
                }
                
                await supabase
                  .from('orders')
                  .update({
                    status: 'returned',
                    returned_at: actualReturnDate
                  })
                  .eq('id', order.id);
                
                results.returned++;
                results.updated++;
                console.log(`↩️ Order ${order.order_number} marked as RETURNED at ${actualReturnDate}`);
                
              } else {
                results.noChange++;
                console.log(`⏭️ Order ${order.order_number}: ${tracking.status} (no status change needed)`);
              }
            } else {
              results.noChange++;
            }
          } catch (invokeError: any) {
            clearTimeout(timeoutId);
            if (invokeError.name === 'AbortError') {
              console.error(`Timeout tracking ${order.tracking_id}`);
              results.failed++;
              results.errors.push({
                order_id: order.id,
                order_number: order.order_number,
                tracking_id: order.tracking_id,
                error: 'Tracking request timed out'
              });
            } else {
              throw invokeError;
            }
          }
          
        } catch (error: any) {
          console.error(`Error processing order ${order.order_number}:`, error);
          results.failed++;
          results.errors.push({
            order_id: order.id,
            order_number: order.order_number,
            tracking_id: order.tracking_id,
            error: error.message
          });
        }
      });
      
      // Wait for parallel batch to complete
      await Promise.all(batchPromises);
      
      // Small delay between parallel batches to avoid overwhelming APIs
      if (i + PARALLEL_BATCH_SIZE < (activeOrders?.length || 0)) {
        await new Promise(resolve => setTimeout(resolve, 200));
      }
    }

    const hasMore = (activeOrders?.length || 0) === limit;
    console.log(`✨ Nightly tracking update batch complete:`, { ...results, offset, hasMore });

    return new Response(
      JSON.stringify({
        success: true,
        trigger,
        offset,
        limit,
        hasMore,
        results
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error: any) {
    console.error('Error in nightly-tracking-update:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
