import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

type VerifyRequest = {
  batchSize?: number;
  onlyUnverified?: boolean;
  includeUntracked?: boolean; // NEW: include orders without any tracking history
};

function toISOIfValid(value: any): string | null {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

function extractPostExDeliveredAt(tracking: any): string | null {
  const direct =
    toISOIfValid(tracking?.updatedAt) ||
    toISOIfValid(tracking?.transactionDateTime) ||
    toISOIfValid(tracking?.deliveredAt);
  if (direct) return direct;

  const history = Array.isArray(tracking?.statusHistory) ? tracking.statusHistory : [];
  const deliveredEvent = history.find(
    (e: any) =>
      String(e?.status ?? '').toLowerCase() === 'delivered' ||
      String(e?.message ?? '').toLowerCase().includes('delivered')
  );

  return (
    toISOIfValid(deliveredEvent?.timestamp) ||
    toISOIfValid(deliveredEvent?.raw?.updatedAt) ||
    toISOIfValid(deliveredEvent?.raw?.transactionDateTime)
  );
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { batchSize = 50, onlyUnverified = true, includeUntracked = false } = (await req.json().catch(() => ({}))) as VerifyRequest;
    const limit = Math.min(Math.max(batchSize, 1), 200);

    console.log(`Starting PostEx verification (batch=${limit}, onlyUnverified=${onlyUnverified}, includeUntracked=${includeUntracked})...`);

    let ordersToVerify: any[] = [];

    if (includeUntracked) {
      // MODE: Find orders marked delivered but with NO tracking history at all
      console.log('Mode: Verifying untracked PostEx orders...');
      
      // Get all PostEx delivered orders
      const { data: allDelivered, error: fetchError } = await supabaseAdmin
        .from('orders')
        .select('id, order_number, status, courier, tracking_id, tags, delivered_at')
        .eq('status', 'delivered')
        .eq('courier', 'postex')
        .not('tracking_id', 'is', null)
        .limit(5000); // Get more to filter

      if (fetchError) throw fetchError;

      if (allDelivered && allDelivered.length > 0) {
        const orderIds = allDelivered.map((o) => o.id);
        
        // Find which orders have ANY tracking history
        const { data: trackingHistory } = await supabaseAdmin
          .from('courier_tracking_history')
          .select('order_id')
          .in('order_id', orderIds);

        const ordersWithTracking = new Set(trackingHistory?.map((t) => t.order_id) || []);
        
        // Filter to orders WITHOUT any tracking history
        const untrackedOrders = allDelivered.filter((o) => !ordersWithTracking.has(o.id));
        console.log(`Found ${untrackedOrders.length} PostEx delivered orders without tracking history`);
        
        ordersToVerify = untrackedOrders.slice(0, limit);
      }
    } else {
      // Original behavior: check orders that have tracking IDs
      const { data: deliveredOrders, error: fetchError } = await supabaseAdmin
        .from('orders')
        .select('id, order_number, status, courier, tracking_id, tags, delivered_at')
        .eq('status', 'delivered')
        .eq('courier', 'postex')
        .not('tracking_id', 'is', null)
        .order('delivered_at', { ascending: true })
        .limit(limit);

      if (fetchError) throw fetchError;

      if (!deliveredOrders || deliveredOrders.length === 0) {
        return new Response(
          JSON.stringify({ success: true, message: 'No PostEx orders to verify', verified: 0, downgraded: 0 }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      ordersToVerify = deliveredOrders;

      if (onlyUnverified) {
        const orderIds = deliveredOrders.map((o) => o.id);
        const { data: trackingHistory } = await supabaseAdmin
          .from('courier_tracking_history')
          .select('order_id')
          .in('order_id', orderIds)
          .eq('status', 'delivered');

        const verifiedOrderIds = new Set(trackingHistory?.map((t) => t.order_id) || []);
        ordersToVerify = deliveredOrders.filter((o) => !verifiedOrderIds.has(o.id));
        console.log(`Filtered to ${ordersToVerify.length} unverified orders out of ${deliveredOrders.length}`);
      }
    }

    if (ordersToVerify.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          message: includeUntracked 
            ? 'No untracked PostEx orders found' 
            : 'All PostEx orders in this batch already verified',
          verified: 0,
          downgraded: 0,
          totalUntracked: 0,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let verifiedCount = 0;
    let downgradedCount = 0;
    let errorCount = 0;
    const downgradedOrders: any[] = [];
    const errors: any[] = [];

    for (const order of ordersToVerify) {
      try {
        console.log(`Checking ${order.order_number} (${order.tracking_id})`);

        const { data: trackingData, error: trackingError } = await supabaseAdmin.functions.invoke('courier-tracking', {
          body: { trackingId: order.tracking_id, courierCode: 'postex' },
        });

        if (trackingError || !trackingData || !trackingData.success) {
          console.error(`Tracking error for ${order.order_number}:`, trackingError || trackingData?.error);
          errorCount++;
          errors.push({
            order_number: order.order_number,
            tracking_id: order.tracking_id,
            error: trackingError?.message || trackingData?.error || 'Unknown error',
          });
          continue;
        }

        const tracking = trackingData.tracking || {};
        const courierStatus = String(tracking.status || '').toLowerCase();
        console.log(`${order.order_number}: PostEx status = "${courierStatus}"`);

        const isActuallyDelivered =
          courierStatus.includes('delivered') || courierStatus.includes('complete') || courierStatus.includes('received');

        if (isActuallyDelivered) {
          const actualDeliveryDate = extractPostExDeliveredAt(tracking);

          if (actualDeliveryDate && actualDeliveryDate !== order.delivered_at) {
            console.log(
              `Updating ${order.order_number} delivered_at from ${order.delivered_at ?? 'null'} to ${actualDeliveryDate}`
            );

            const { error: updateError } = await supabaseAdmin
              .from('orders')
              .update({ delivered_at: actualDeliveryDate })
              .eq('id', order.id);

            if (updateError) {
              console.error(`Failed to update delivered_at for ${order.order_number}:`, updateError);
            }
          }

          verifiedCount++;
          console.log(`✓ ${order.order_number} confirmed delivered (actual: ${actualDeliveryDate || order.delivered_at})`);
        } else {
          let newStatus = 'dispatched';

          if (courierStatus.includes('transit') || courierStatus.includes('in transit')) {
            newStatus = 'dispatched';
          } else if (courierStatus.includes('booked') || courierStatus.includes('picked')) {
            newStatus = 'booked';
          } else if (courierStatus.includes('return') || courierStatus.includes('rto')) {
            newStatus = 'returned';
          } else if (courierStatus.includes('cancel')) {
            newStatus = 'cancelled';
          } else if (courierStatus.includes('warehouse') || courierStatus.includes('hub')) {
            newStatus = 'dispatched';
          }

          console.log(`✗ ${order.order_number} NOT delivered (PostEx: ${courierStatus}), downgrading to ${newStatus}`);

          const currentTags = order.tags || [];
          const updatedTags = currentTags.map((tag: string) =>
            tag === 'Ecomnet - Delivered'
              ? `Ecomnet - ${newStatus.charAt(0).toUpperCase() + newStatus.slice(1)}`
              : tag
          );

          const { error: updateError } = await supabaseAdmin
            .from('orders')
            .update({ status: newStatus, tags: updatedTags, delivered_at: null })
            .eq('id', order.id);

          if (updateError) {
            console.error(`Update error for ${order.order_number}:`, updateError);
            errorCount++;
            errors.push({ order_number: order.order_number, error: updateError.message });
            continue;
          }

          await supabaseAdmin.from('activity_logs').insert({
            action: 'postex_verification_downgrade',
            entity_type: 'order',
            entity_id: order.id,
            details: {
              order_number: order.order_number,
              previous_status: 'delivered',
              new_status: newStatus,
              courier_status: courierStatus,
              tracking_id: order.tracking_id,
              reason: includeUntracked 
                ? 'PostEx API verification - untracked order not actually delivered'
                : 'PostEx API verification - order not actually delivered',
            },
            user_id: '00000000-0000-0000-0000-000000000000',
          });

          downgradedCount++;
          downgradedOrders.push({
            order_number: order.order_number,
            tracking_id: order.tracking_id,
            postex_status: courierStatus,
            new_status: newStatus,
          });
        }

        await new Promise((resolve) => setTimeout(resolve, 200));
      } catch (orderError: any) {
        console.error(`Exception for ${order.order_number}:`, orderError);
        errorCount++;
        errors.push({ order_number: order.order_number, error: orderError.message });
      }
    }

    console.log(`PostEx verification complete: ${verifiedCount} confirmed, ${downgradedCount} downgraded, ${errorCount} errors`);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Verified ${ordersToVerify.length} PostEx orders`,
        processed: ordersToVerify.length,
        verified: verifiedCount,
        downgraded: downgradedCount,
        errors: errorCount,
        mode: includeUntracked ? 'untracked' : 'standard',
        downgradedOrders: downgradedOrders.length > 0 ? downgradedOrders : undefined,
        errorDetails: errors.length > 0 ? errors : undefined,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('Error in verify-postex-orders:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
