import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface FixRequest {
  batchSize?: number;
  maxBatches?: number;
  dryRun?: boolean;
  orderNumbers?: string[]; // Specific orders to fix
  courierCode?: string; // Default: postex
}

interface PostExTrackingResponse {
  status?: string;
  statusCode?: string;
  message?: string;
  data?: {
    statusCode?: string;
    statusMessage?: string;
    tracking?: {
      transactionStatusHistoryList?: Array<{
        status?: string;
        statusMessage?: string;
        time?: string;
        dateTime?: string;
      }>;
      transactionDateTime?: string;
      updatedAt?: string;
    };
  };
}

async function fetchPostExTracking(trackingId: string, apiSettings: any): Promise<any> {
  const token = apiSettings.POSTEX_API_KEY;
  if (!token) {
    throw new Error('PostEx API token not configured (POSTEX_API_KEY)');
  }

  // Use path parameter format like courier-tracking function
  const url = `https://api.postex.pk/services/integration/api/order/v1/track-order/${trackingId}`;
  
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'token': token,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`PostEx API error: ${response.status} - ${errorText}`);
  }

  return response.json();
}

// PostEx response has the data in data.dist.transactionStatusHistory format
function extractDeliveryDate(trackingData: any): string | null {
  // PostEx returns: { dist: { transactionStatusHistory: [...], ... } }
  const dist = trackingData?.dist;
  if (!dist) return null;

  // Find the "Delivered" event in history (code 0005 = Delivered)
  const historyList = dist.transactionStatusHistory || [];
  const deliveredEvent = historyList.find(
    (event: any) => {
      const code = event.transactionStatusMessageCode;
      const message = (event.transactionStatusMessage || '').toLowerCase();
      return code === '0005' || message.includes('delivered');
    }
  );

  if (deliveredEvent) {
    const dateStr = deliveredEvent.updatedAt || deliveredEvent.transactionDateTime;
    if (dateStr) {
      const parsed = new Date(dateStr);
      if (!isNaN(parsed.getTime())) {
        return parsed.toISOString();
      }
    }
  }

  // Fallback to the latest event with 0005 code or any "delivered" status
  const anyDeliveredEvent = historyList.find(
    (event: any) => event.transactionStatusMessageCode === '0005'
  );
  if (anyDeliveredEvent) {
    const dateStr = anyDeliveredEvent.updatedAt || anyDeliveredEvent.transactionDateTime;
    if (dateStr) {
      const parsed = new Date(dateStr);
      if (!isNaN(parsed.getTime())) {
        return parsed.toISOString();
      }
    }
  }

  return null;
}

function extractReturnDate(trackingData: PostExTrackingResponse): string | null {
  const tracking = trackingData.data?.tracking;
  if (!tracking) return null;

  const historyList = tracking.transactionStatusHistoryList || [];
  const returnedEvent = historyList.find(
    (event) => event.status?.toLowerCase() === 'returned' || 
               event.statusMessage?.toLowerCase().includes('returned')
  );

  if (returnedEvent) {
    const dateStr = returnedEvent.dateTime || returnedEvent.time;
    if (dateStr) {
      const parsed = new Date(dateStr);
      if (!isNaN(parsed.getTime())) {
        return parsed.toISOString();
      }
    }
  }

  const fallback = tracking.updatedAt || tracking.transactionDateTime;
  if (fallback) {
    const parsed = new Date(fallback);
    if (!isNaN(parsed.getTime())) {
      return parsed.toISOString();
    }
  }

  return null;
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

    const body = (await req.json().catch(() => ({}))) as FixRequest;
    const batchSize = Math.min(Math.max(body.batchSize ?? 50, 1), 200);
    const maxBatches = Math.min(Math.max(body.maxBatches ?? 10, 1), 50);
    const dryRun = Boolean(body.dryRun);
    const courierCode = body.courierCode || 'postex';

    console.log(`Starting delivery date fix (batchSize=${batchSize}, maxBatches=${maxBatches}, dryRun=${dryRun}, courier=${courierCode})`);

    // Fetch API settings
    const { data: apiSettingsData, error: settingsError } = await supabaseAdmin
      .from('api_settings')
      .select('setting_key, setting_value');

    if (settingsError) {
      throw new Error(`Failed to fetch API settings: ${settingsError.message}`);
    }

    const apiSettings: Record<string, string> = {};
    for (const row of apiSettingsData || []) {
      apiSettings[row.setting_key] = row.setting_value;
    }

    // Build query for orders - only delivered orders (returned orders don't have returned_at column)
    let ordersQuery = supabaseAdmin
      .from('orders')
      .select('id, order_number, status, tracking_id, courier, delivered_at')
      .eq('courier', courierCode)
      .not('tracking_id', 'is', null)
      .eq('status', 'delivered');

    if (body.orderNumbers && body.orderNumbers.length > 0) {
      ordersQuery = ordersQuery.in('order_number', body.orderNumbers);
    }

    const results = {
      processed: 0,
      updated: 0,
      skipped: 0,
      errors: 0,
      updates: [] as any[],
      errorDetails: [] as any[],
    };

    let offset = 0;
    for (let batch = 1; batch <= maxBatches; batch++) {
      const { data: orders, error: ordersError } = await ordersQuery
        .order('delivered_at', { ascending: false, nullsFirst: true })
        .range(offset, offset + batchSize - 1);

      if (ordersError) {
        throw new Error(`Failed to fetch orders: ${ordersError.message}`);
      }

      if (!orders || orders.length === 0) {
        console.log(`Batch ${batch}: No more orders to process`);
        break;
      }

      console.log(`Batch ${batch}: Processing ${orders.length} orders`);

      for (const order of orders) {
        results.processed++;

        try {
          // Call PostEx API to get actual tracking data
          const trackingData = await fetchPostExTracking(order.tracking_id, apiSettings);
          
          const actualDate = extractDeliveryDate(trackingData);
          const fieldToUpdate = 'delivered_at';
          const currentValue = order.delivered_at;

          if (!actualDate) {
            console.log(`⚠️ Order ${order.order_number}: Could not extract date from tracking data`);
            results.skipped++;
            continue;
          }

          // Compare dates (ignoring time)
          const currentDateStr = currentValue ? new Date(currentValue).toISOString().split('T')[0] : null;
          const actualDateStr = new Date(actualDate).toISOString().split('T')[0];

          if (currentDateStr === actualDateStr) {
            console.log(`✓ Order ${order.order_number}: Date already correct (${actualDateStr})`);
            results.skipped++;
            continue;
          }

          console.log(`📅 Order ${order.order_number}: ${currentDateStr} -> ${actualDateStr}`);

          if (!dryRun) {
            const updateData: any = {};
            updateData[fieldToUpdate!] = actualDate;

            const { error: updateError } = await supabaseAdmin
              .from('orders')
              .update(updateData)
              .eq('id', order.id);

            if (updateError) {
              console.error(`❌ Update error for ${order.order_number}:`, updateError);
              results.errors++;
              results.errorDetails.push({
                order_number: order.order_number,
                error: updateError.message,
              });
              continue;
            }
          }

          results.updated++;
          if (results.updates.length < 100) {
            results.updates.push({
              order_number: order.order_number,
              field: fieldToUpdate,
              old_value: currentValue,
              new_value: actualDate,
            });
          }

          // Small delay to avoid rate limiting
          await new Promise((resolve) => setTimeout(resolve, 100));

        } catch (orderError: any) {
          console.error(`❌ Error processing order ${order.order_number}:`, orderError.message);
          results.errors++;
          results.errorDetails.push({
            order_number: order.order_number,
            error: orderError.message,
          });
        }
      }

      if (orders.length < batchSize) {
        console.log(`Batch ${batch}: End of orders`);
        break;
      }

      offset += batchSize;
    }

    console.log(`Fix complete: ${results.updated} updated, ${results.skipped} skipped, ${results.errors} errors`);

    return new Response(
      JSON.stringify({
        success: true,
        message: dryRun
          ? `Dry run: Would update ${results.updated} orders`
          : `Updated ${results.updated} orders with correct delivery dates`,
        ...results,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error in fix-delivery-dates-from-api:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
