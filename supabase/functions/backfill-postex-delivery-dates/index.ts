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

    const { batchSize = 100, dryRun = false } = await req.json().catch(() => ({}));
    const limit = Math.min(Math.max(batchSize, 1), 500);

    console.log(`Starting PostEx delivery date backfill (batch: ${limit}, dryRun: ${dryRun})...`);

    // Get PostEx delivered orders that have tracking history with 'delivered' status
    const { data: trackingRecords, error: fetchError } = await supabaseAdmin
      .from('courier_tracking_history')
      .select(`
        id,
        order_id,
        tracking_id,
        status,
        checked_at,
        raw_response,
        orders!inner (
          id,
          order_number,
          status,
          courier,
          delivered_at
        )
      `)
      .eq('status', 'delivered')
      .eq('orders.courier', 'postex')
      .eq('orders.status', 'delivered')
      .order('checked_at', { ascending: false })
      .limit(limit);

    if (fetchError) {
      console.error('Error fetching tracking records:', fetchError);
      throw fetchError;
    }

    if (!trackingRecords || trackingRecords.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'No PostEx delivered orders with tracking history found',
          updated: 0
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Found ${trackingRecords.length} PostEx delivered tracking records`);

    // Group by order_id to get the earliest delivered event per order
    const orderDeliveryDates = new Map<string, { orderId: string, orderNumber: string, currentDeliveredAt: string, actualDeliveryDate: string }>();

    for (const record of trackingRecords) {
      const orderId = record.order_id;
      const order = record.orders as any;
      
      // Extract actual delivery timestamp from raw_response
      const actualDeliveryDate = record.raw_response?.updatedAt || 
                                  record.raw_response?.transactionDateTime || 
                                  record.checked_at;
      
      if (!actualDeliveryDate) continue;
      
      // Only keep the earliest delivery date per order
      const existing = orderDeliveryDates.get(orderId);
      if (!existing || new Date(actualDeliveryDate) < new Date(existing.actualDeliveryDate)) {
        orderDeliveryDates.set(orderId, {
          orderId,
          orderNumber: order.order_number,
          currentDeliveredAt: order.delivered_at,
          actualDeliveryDate
        });
      }
    }

    console.log(`Processing ${orderDeliveryDates.size} unique orders`);

    let updatedCount = 0;
    let skippedCount = 0;
    const updates: any[] = [];
    const errors: any[] = [];

    for (const [orderId, data] of orderDeliveryDates) {
      try {
        // Check if dates are different (compare just the date part)
        const currentDate = data.currentDeliveredAt ? new Date(data.currentDeliveredAt).toISOString().split('T')[0] : null;
        const actualDate = new Date(data.actualDeliveryDate).toISOString().split('T')[0];
        
        if (currentDate === actualDate) {
          skippedCount++;
          continue;
        }

        console.log(`${data.orderNumber}: ${data.currentDeliveredAt} -> ${data.actualDeliveryDate}`);
        
        if (!dryRun) {
          const { error: updateError } = await supabaseAdmin
            .from('orders')
            .update({ delivered_at: data.actualDeliveryDate })
            .eq('id', orderId);

          if (updateError) {
            console.error(`Update error for ${data.orderNumber}:`, updateError);
            errors.push({ order_number: data.orderNumber, error: updateError.message });
            continue;
          }
        }

        updatedCount++;
        updates.push({
          order_number: data.orderNumber,
          old_delivered_at: data.currentDeliveredAt,
          new_delivered_at: data.actualDeliveryDate
        });

      } catch (orderError: any) {
        console.error(`Exception for order ${orderId}:`, orderError);
        errors.push({ order_id: orderId, error: orderError.message });
      }
    }

    console.log(`PostEx delivery date backfill complete: ${updatedCount} updated, ${skippedCount} skipped, ${errors.length} errors`);

    return new Response(
      JSON.stringify({
        success: true,
        message: dryRun ? 'Dry run completed' : `Updated ${updatedCount} PostEx orders with actual delivery dates`,
        processed: orderDeliveryDates.size,
        updated: updatedCount,
        skipped: skippedCount,
        errors: errors.length,
        updates: updates.length > 0 ? updates.slice(0, 50) : undefined, // Limit output
        errorDetails: errors.length > 0 ? errors : undefined,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('Error in backfill-postex-delivery-dates:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
