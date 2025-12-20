import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

type BackfillRequest = {
  batchSize?: number;
  dryRun?: boolean;
  maxBatches?: number;
  startCheckedAt?: string; // ISO
  endCheckedAt?: string; // ISO
};

type TrackingRow = {
  id: string;
  order_id: string;
  tracking_id: string;
  status: string;
  checked_at: string;
  raw_response: any;
  orders: {
    id: string;
    order_number: string;
    status: string;
    courier: string;
    delivered_at: string | null;
  };
};

function pickActualDeliveryDate(record: TrackingRow): string | null {
  // PostEx commonly provides `updatedAt` in the raw response.
  const raw = record.raw_response ?? {};
  const candidate = raw.updatedAt || raw.transactionDateTime || record.checked_at;
  if (!candidate) return null;

  const d = new Date(candidate);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
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

    const body = (await req.json().catch(() => ({}))) as BackfillRequest;
    const batchSize = Math.min(Math.max(body.batchSize ?? 500, 1), 1000);
    const maxBatches = Math.min(Math.max(body.maxBatches ?? 20, 1), 200);
    const dryRun = Boolean(body.dryRun);

    console.log(
      `Starting PostEx delivery date backfill (batchSize=${batchSize}, maxBatches=${maxBatches}, dryRun=${dryRun})`
    );

    const orderDeliveryDates = new Map<
      string,
      {
        orderId: string;
        orderNumber: string;
        currentDeliveredAt: string | null;
        actualDeliveryDate: string;
      }
    >();

    let scannedRecords = 0;
    let offset = 0;

    for (let batch = 1; batch <= maxBatches; batch++) {
      let query = supabaseAdmin
        .from('courier_tracking_history')
        .select(
          `
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
        `
        )
        .eq('status', 'delivered')
        .eq('orders.courier', 'postex')
        .eq('orders.status', 'delivered')
        .order('checked_at', { ascending: false })
        .range(offset, offset + batchSize - 1);

      if (body.startCheckedAt) query = query.gte('checked_at', body.startCheckedAt);
      if (body.endCheckedAt) query = query.lte('checked_at', body.endCheckedAt);

      const { data, error } = await query;
      if (error) {
        console.error('Error fetching tracking records:', error);
        throw error;
      }

      const trackingRecords = (data ?? []) as unknown as TrackingRow[];
      if (trackingRecords.length === 0) break;

      scannedRecords += trackingRecords.length;
      console.log(`Batch ${batch}: fetched ${trackingRecords.length} tracking rows (offset=${offset})`);

      for (const record of trackingRecords) {
        const order = record.orders as any;
        const actualISO = pickActualDeliveryDate(record);
        if (!actualISO) continue;

        const existing = orderDeliveryDates.get(record.order_id);
        if (!existing || new Date(actualISO) < new Date(existing.actualDeliveryDate)) {
          orderDeliveryDates.set(record.order_id, {
            orderId: record.order_id,
            orderNumber: order.order_number,
            currentDeliveredAt: order.delivered_at ?? null,
            actualDeliveryDate: actualISO,
          });
        }
      }

      if (trackingRecords.length < batchSize) break;
      offset += batchSize;
    }

    if (orderDeliveryDates.size === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          message: 'No PostEx delivered orders with tracking history found (in the requested range)',
          scannedRecords,
          updated: 0,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Collected ${orderDeliveryDates.size} unique orders from ${scannedRecords} tracking rows`);

    let updatedCount = 0;
    let skippedCount = 0;
    const updates: any[] = [];
    const errors: any[] = [];

    for (const [, data] of orderDeliveryDates) {
      try {
        const currentDate = data.currentDeliveredAt
          ? new Date(data.currentDeliveredAt).toISOString().split('T')[0]
          : null;
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
            .eq('id', data.orderId);

          if (updateError) {
            console.error(`Update error for ${data.orderNumber}:`, updateError);
            errors.push({ order_number: data.orderNumber, error: updateError.message });
            continue;
          }
        }

        updatedCount++;
        if (updates.length < 50) {
          updates.push({
            order_number: data.orderNumber,
            old_delivered_at: data.currentDeliveredAt,
            new_delivered_at: data.actualDeliveryDate,
          });
        }
      } catch (orderError: any) {
        console.error(`Exception for order ${data.orderId}:`, orderError);
        errors.push({ order_id: data.orderId, error: orderError.message });
      }
    }

    console.log(
      `PostEx delivery date backfill complete: ${updatedCount} updated, ${skippedCount} skipped, ${errors.length} errors`
    );

    return new Response(
      JSON.stringify({
        success: true,
        message: dryRun
          ? 'Dry run completed'
          : `Updated ${updatedCount} PostEx orders with actual delivery dates`,
        scannedRecords,
        uniqueOrders: orderDeliveryDates.size,
        updated: updatedCount,
        skipped: skippedCount,
        errors: errors.length,
        updates: updates.length > 0 ? updates : undefined,
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
