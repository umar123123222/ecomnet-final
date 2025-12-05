import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const body = await req.json();
    const { operation, ageThresholdDays = 30, limit = 50, offset = 0, dryRun = false } = body;

    console.log(`Bulk cleanup operation: ${operation}, threshold: ${ageThresholdDays} days, limit: ${limit}, offset: ${offset}, dryRun: ${dryRun}`);

    const results = {
      operation,
      processed: 0,
      success: 0,
      failed: 0,
      skipped: 0,
      hasMore: false,
      details: [] as any[],
      errors: [] as string[],
    };

    const thresholdDate = new Date();
    thresholdDate.setDate(thresholdDate.getDate() - ageThresholdDays);
    const thresholdISO = thresholdDate.toISOString();

    switch (operation) {
      case 'dispatch_booked': {
        // Find booked orders with tracking_id but no dispatch record
        const { data: bookedOrders, error: fetchError } = await supabase
          .from('orders')
          .select(`
            id, order_number, tracking_id, courier, booked_at, created_at,
            dispatches!left(id)
          `)
          .eq('status', 'booked')
          .not('tracking_id', 'is', null)
          .neq('tracking_id', '')
          .lt('updated_at', thresholdISO)
          .range(offset, offset + limit - 1);

        if (fetchError) throw fetchError;

        // Filter orders without dispatch records
        const ordersToDispatch = bookedOrders?.filter(o => !o.dispatches || o.dispatches.length === 0) || [];
        results.hasMore = (bookedOrders?.length || 0) === limit;

        console.log(`Found ${ordersToDispatch.length} booked orders without dispatch records`);

        if (dryRun) {
          results.processed = ordersToDispatch.length;
          results.details = ordersToDispatch.map(o => ({
            order_number: o.order_number,
            tracking_id: o.tracking_id,
            courier: o.courier,
            action: 'would_dispatch'
          }));
          break;
        }

        for (const order of ordersToDispatch) {
          try {
            // Create dispatch record
            const { error: dispatchError } = await supabase
              .from('dispatches')
              .insert({
                order_id: order.id,
                courier: order.courier || 'Unknown',
                tracking_id: order.tracking_id,
                dispatch_date: order.booked_at || new Date().toISOString(),
              });

            if (dispatchError) throw dispatchError;

            // Update order status to dispatched
            const { error: updateError } = await supabase
              .from('orders')
              .update({
                status: 'dispatched',
                dispatched_at: order.booked_at || new Date().toISOString(),
              })
              .eq('id', order.id);

            if (updateError) throw updateError;

            results.success++;
            results.details.push({
              order_number: order.order_number,
              action: 'dispatched',
              tracking_id: order.tracking_id,
            });
          } catch (err) {
            results.failed++;
            results.errors.push(`${order.order_number}: ${err.message}`);
          }
          results.processed++;
        }
        break;
      }

      case 'cancel_old': {
        // Find old pending/booked orders to cancel
        const { data: oldOrders, error: fetchError } = await supabase
          .from('orders')
          .select('id, order_number, status, created_at')
          .in('status', ['pending', 'booked'])
          .lt('created_at', thresholdISO)
          .range(offset, offset + limit - 1);

        if (fetchError) throw fetchError;

        results.hasMore = (oldOrders?.length || 0) === limit;

        console.log(`Found ${oldOrders?.length || 0} old orders to cancel`);

        if (dryRun) {
          results.processed = oldOrders?.length || 0;
          results.details = oldOrders?.map(o => ({
            order_number: o.order_number,
            status: o.status,
            created_at: o.created_at,
            action: 'would_cancel'
          })) || [];
          break;
        }

        for (const order of oldOrders || []) {
          try {
            const { error: updateError } = await supabase
              .from('orders')
              .update({
                status: 'cancelled',
                cancellation_reason: `Auto-cancelled: Order older than ${ageThresholdDays} days without progress`,
                cancelled_at: new Date().toISOString(),
              })
              .eq('id', order.id);

            if (updateError) throw updateError;

            results.success++;
            results.details.push({
              order_number: order.order_number,
              action: 'cancelled',
              previous_status: order.status,
            });
          } catch (err) {
            results.failed++;
            results.errors.push(`${order.order_number}: ${err.message}`);
          }
          results.processed++;
        }
        break;
      }

      case 'force_delivered': {
        // Find dispatched orders with tracking showing delivered
        // First get orders, then check their latest tracking status
        const { data: dispatchedOrders, error: fetchError } = await supabase
          .from('orders')
          .select(`
            id, order_number, tracking_id, courier,
            dispatches!inner(id, tracking_id)
          `)
          .eq('status', 'dispatched')
          .not('tracking_id', 'is', null)
          .lt('updated_at', thresholdISO)
          .range(offset, offset + limit - 1);

        if (fetchError) throw fetchError;

        results.hasMore = (dispatchedOrders?.length || 0) === limit;

        // Get tracking history for these orders
        const orderIds = dispatchedOrders?.map(o => o.id) || [];
        
        if (orderIds.length === 0) {
          console.log('No dispatched orders found');
          break;
        }

        // Fetch latest tracking status in chunks
        const chunkSize = 100;
        const trackingMap = new Map<string, string>();
        
        for (let i = 0; i < orderIds.length; i += chunkSize) {
          const chunk = orderIds.slice(i, i + chunkSize);
          const { data: trackingData } = await supabase
            .from('courier_tracking_history')
            .select('order_id, status, checked_at')
            .in('order_id', chunk)
            .order('checked_at', { ascending: false });

          // Get latest status per order
          trackingData?.forEach(t => {
            if (!trackingMap.has(t.order_id)) {
              trackingMap.set(t.order_id, t.status);
            }
          });
        }

        console.log(`Found ${dispatchedOrders?.length || 0} dispatched orders, checking tracking...`);

        if (dryRun) {
          results.processed = dispatchedOrders?.length || 0;
          results.details = dispatchedOrders?.map(o => ({
            order_number: o.order_number,
            tracking_id: o.tracking_id,
            latest_tracking_status: trackingMap.get(o.id) || 'unknown',
            action: 'would_check'
          })) || [];
          break;
        }

        for (const order of dispatchedOrders || []) {
          const latestStatus = trackingMap.get(order.id);
          
          if (latestStatus === 'delivered') {
            try {
              const { error: updateError } = await supabase
                .from('orders')
                .update({
                  status: 'delivered',
                  delivered_at: new Date().toISOString(),
                })
                .eq('id', order.id);

              if (updateError) throw updateError;

              results.success++;
              results.details.push({
                order_number: order.order_number,
                action: 'marked_delivered',
                tracking_status: latestStatus,
              });
            } catch (err) {
              results.failed++;
              results.errors.push(`${order.order_number}: ${err.message}`);
            }
          } else if (latestStatus === 'returned') {
            try {
              const { error: updateError } = await supabase
                .from('orders')
                .update({
                  status: 'returned',
                  returned_at: new Date().toISOString(),
                })
                .eq('id', order.id);

              if (updateError) throw updateError;

              results.success++;
              results.details.push({
                order_number: order.order_number,
                action: 'marked_returned',
                tracking_status: latestStatus,
              });
            } catch (err) {
              results.failed++;
              results.errors.push(`${order.order_number}: ${err.message}`);
            }
          } else {
            results.skipped++;
            results.details.push({
              order_number: order.order_number,
              action: 'skipped',
              tracking_status: latestStatus || 'no_tracking',
            });
          }
          results.processed++;
        }
        break;
      }

      default:
        return new Response(JSON.stringify({ 
          success: false, 
          error: `Unknown operation: ${operation}` 
        }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }

    console.log(`Operation complete: ${results.success} success, ${results.failed} failed, ${results.skipped} skipped`);

    return new Response(JSON.stringify({ success: true, ...results }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Bulk cleanup error:', error);
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
