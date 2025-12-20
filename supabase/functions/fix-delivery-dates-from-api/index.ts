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

async function fetchLeopardTracking(trackingId: string, apiSettings: any): Promise<any> {
  const apiKey = apiSettings.LEOPARD_API_KEY;
  const apiPassword = apiSettings.LEOPARD_API_PASSWORD;
  
  if (!apiKey || !apiPassword) {
    throw new Error('Leopard API credentials not configured (LEOPARD_API_KEY and LEOPARD_API_PASSWORD)');
  }

  const url = 'https://merchantapi.leopardscourier.com/api/trackBookedPacket/format/json/';
  
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      api_key: apiKey,
      api_password: apiPassword,
      track_numbers: trackingId
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Leopard API error: ${response.status} - ${errorText}`);
  }

  return response.json();
}

async function fetchTCSTracking(trackingId: string, apiSettings: any): Promise<any> {
  const apiKey = apiSettings.TCS_API_KEY;
  
  if (!apiKey) {
    throw new Error('TCS API key not configured (TCS_API_KEY)');
  }

  // TCS tracking endpoint - use the ecom/api/shipmentTracking endpoint with consignee query param
  // This is what the courier-tracking function uses for TCS
  const url = `https://devconnect.tcscourier.com/ecom/api/shipmentTracking/track?consignee=${trackingId}`;
  
  console.log(`[TCS] Fetching tracking for ${trackingId}`);
  
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
  });

  const responseText = await response.text();
  
  // Log response status for debugging
  console.log(`[TCS] Response status: ${response.status}`);
  
  if (responseText.trim() === '' || response.status === 404) {
    // TCS API may return 404 for old orders or orders not in their system
    console.log(`[TCS] Empty response or 404 for ${trackingId}`);
    return null;
  }
  
  // Try to parse as JSON
  try {
    const data = JSON.parse(responseText);
    console.log(`[TCS] Response for ${trackingId}:`, JSON.stringify(data, null, 2).substring(0, 500));
    return data;
  } catch {
    // If response is not JSON, return null
    console.log(`[TCS] Invalid JSON response for ${trackingId}: ${responseText.substring(0, 100)}`);
    return null;
  }
}

// PostEx response has the data in data.dist.transactionStatusHistory format
// IMPORTANT: Returns the FIRST (earliest) delivered date
function extractDeliveryDatePostEx(trackingData: any): string | null {
  // PostEx returns: { dist: { transactionStatusHistory: [...], ... } }
  const dist = trackingData?.dist;
  if (!dist) return null;

  // Find ALL "Delivered" events in history (code 0005 = Delivered)
  const historyList = dist.transactionStatusHistory || [];
  const deliveredEvents = historyList.filter(
    (event: any) => {
      const code = event.transactionStatusMessageCode;
      const message = (event.transactionStatusMessage || '').toLowerCase();
      return code === '0005' || message.includes('delivered');
    }
  );

  if (deliveredEvents.length === 0) return null;

  // Sort by date ascending to get the FIRST (earliest) delivered event
  deliveredEvents.sort((a: any, b: any) => {
    const dateA = new Date(a.updatedAt || a.transactionDateTime || 0).getTime();
    const dateB = new Date(b.updatedAt || b.transactionDateTime || 0).getTime();
    return dateA - dateB;
  });

  const firstDelivered = deliveredEvents[0];
  const dateStr = firstDelivered.updatedAt || firstDelivered.transactionDateTime;
  if (dateStr) {
    const parsed = new Date(dateStr);
    if (!isNaN(parsed.getTime())) {
      return parsed.toISOString();
    }
  }

  return null;
}

// Leopard response parser - returns the FIRST (earliest) delivered date
function extractDeliveryDateLeopard(trackingData: any): string | null {
  const packet = trackingData?.packet_list?.[0];
  if (!packet) return null;

  const trackingDetail = packet['Tracking Detail'] || [];
  
  // Find ALL "Delivered" events
  const deliveredEvents = trackingDetail.filter((event: any) => {
    const status = (event.Status || '').toUpperCase();
    return status.includes('DELIVERED');
  });

  if (deliveredEvents.length === 0) return null;

  // Sort by date ascending to get the FIRST (earliest) delivered event
  deliveredEvents.sort((a: any, b: any) => {
    let timestampA = a.Activity_datetime;
    if (!timestampA && a.Activity_Date) {
      timestampA = a.Activity_Time 
        ? `${a.Activity_Date} ${a.Activity_Time}`
        : a.Activity_Date;
    }
    
    let timestampB = b.Activity_datetime;
    if (!timestampB && b.Activity_Date) {
      timestampB = b.Activity_Time 
        ? `${b.Activity_Date} ${b.Activity_Time}`
        : b.Activity_Date;
    }
    
    const dateA = new Date(timestampA || 0).getTime();
    const dateB = new Date(timestampB || 0).getTime();
    return dateA - dateB;
  });

  const firstDelivered = deliveredEvents[0];
  
  // Build timestamp from Activity_datetime or Activity_Date + Activity_Time
  let timestamp = firstDelivered.Activity_datetime;
  if (!timestamp && firstDelivered.Activity_Date) {
    timestamp = firstDelivered.Activity_Time 
      ? `${firstDelivered.Activity_Date} ${firstDelivered.Activity_Time}`
      : firstDelivered.Activity_Date;
  }
  
  if (timestamp) {
    const parsed = new Date(timestamp);
    if (!isNaN(parsed.getTime())) {
      return parsed.toISOString();
    }
  }

  return null;
}

// TCS response parser - returns the FIRST (earliest) delivered date
// TCS format: "Friday Dec 5, 2025 21:05"
function parseTCSDateTime(datetime: string): Date | null {
  if (!datetime) return null;
  try {
    // TCS format: "Friday Dec 5, 2025 21:05"
    // Remove day name first
    const withoutDay = datetime.replace(/^[A-Za-z]+ /, '');
    
    // Parse the components manually
    // Format: "Dec 5, 2025 21:05"
    const match = withoutDay.match(/([A-Za-z]+)\s+(\d+),\s+(\d{4})\s+(\d{1,2}):(\d{2})/);
    if (!match) return new Date(datetime);
    
    const [, monthStr, day, year, hours, minutes] = match;
    const months: Record<string, number> = {
      'Jan': 0, 'Feb': 1, 'Mar': 2, 'Apr': 3, 'May': 4, 'Jun': 5,
      'Jul': 6, 'Aug': 7, 'Sep': 8, 'Oct': 9, 'Nov': 10, 'Dec': 11
    };
    const month = months[monthStr] ?? 0;
    
    // Create date in PKT (UTC+5), subtract 5 hours to get correct UTC time
    const pktOffsetHours = 5;
    const date = new Date(Date.UTC(
      parseInt(year),
      month,
      parseInt(day),
      parseInt(hours) - pktOffsetHours,
      parseInt(minutes),
      0
    ));
    
    return date;
  } catch {
    return null;
  }
}

function extractDeliveryDateTCS(trackingData: any): string | null {
  // TCS returns checkpoints at root level
  const checkpoints = trackingData?.checkpoints || [];
  
  if (checkpoints.length === 0) return null;

  // Find ALL "Delivered" events (status contains "DELIVERED")
  const deliveredEvents = checkpoints.filter((event: any) => {
    const status = (event.status || '').toUpperCase();
    return status.includes('DELIVERED');
  });

  if (deliveredEvents.length === 0) return null;

  // Parse dates and sort by timestamp ascending to get the FIRST (earliest) delivered event
  const eventsWithDates = deliveredEvents
    .map((event: any) => ({
      event,
      date: parseTCSDateTime(event.datetime)
    }))
    .filter((e: any) => e.date !== null);

  if (eventsWithDates.length === 0) return null;

  eventsWithDates.sort((a: any, b: any) => a.date!.getTime() - b.date!.getTime());

  const firstDelivered = eventsWithDates[0];
  return firstDelivered.date!.toISOString();
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
          let trackingData: any;
          let actualDate: string | null = null;
          
          // Call appropriate courier API based on courier code
          if (courierCode === 'postex') {
            trackingData = await fetchPostExTracking(order.tracking_id, apiSettings);
            actualDate = extractDeliveryDatePostEx(trackingData);
          } else if (courierCode === 'leopard') {
            trackingData = await fetchLeopardTracking(order.tracking_id, apiSettings);
            actualDate = extractDeliveryDateLeopard(trackingData);
          } else if (courierCode === 'tcs') {
            trackingData = await fetchTCSTracking(order.tracking_id, apiSettings);
            actualDate = extractDeliveryDateTCS(trackingData);
          } else {
            console.log(`⚠️ Order ${order.order_number}: Unsupported courier ${courierCode}`);
            results.skipped++;
            continue;
          }
          
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
