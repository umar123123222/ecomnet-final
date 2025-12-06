import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.2";
import { getAPISetting } from "../_shared/apiSettings.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface TrackingRequest {
  trackingId: string;
  courierCode: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { trackingId, courierCode }: TrackingRequest = await req.json();
    console.log('Tracking request:', trackingId, courierCode);

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Fetch courier configuration from database
    const { data: courier, error: courierError } = await supabase
      .from('couriers')
      .select('*')
      .eq('code', courierCode.toLowerCase())
      .single();

    if (courierError || !courier) {
      throw new Error(`Courier ${courierCode} not found or not configured`);
    }

    let trackingData;

    // Use configured tracking endpoint if available
    if (courier.tracking_endpoint) {
      trackingData = await trackWithCustomEndpoint(trackingId, courier, supabase);
    } else {
      throw new Error(`Tracking endpoint not configured for courier: ${courierCode}. Please add the tracking_endpoint in Business Settings > Couriers.`);
    }

    // Update dispatch record with latest tracking info
    await supabase
      .from('dispatches')
      .update({
        status: trackingData.status,
        last_tracking_update: new Date().toISOString(),
        courier_response: trackingData.raw
      })
      .eq('tracking_id', trackingId);

    return new Response(
      JSON.stringify({
        success: true,
        tracking: trackingData
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error: any) {
    console.error('Error in courier-tracking:', error);
    
    // Return 200 with error details for expected failures (DNS, network issues)
    // This prevents the client from throwing exceptions
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || 'Tracking service unavailable'
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});

// PostEx status code mapping
// Note: Failed delivery attempt codes need verification from PostEx API documentation
const postexStatusMap: Record<string, { status: string; label: string }> = {
  '0001': { status: 'at_warehouse', label: 'At Merchant Warehouse' },
  '0003': { status: 'at_warehouse', label: 'At PostEx Warehouse' },
  '0004': { status: 'in_transit', label: 'Package on Route' },
  '0005': { status: 'delivered', label: 'Delivered' },
  '0008': { status: 'pending', label: 'Delivery Under Review' },
  '0009': { status: 'delivery_failed', label: 'Customer Not Available' },
  '0010': { status: 'delivery_failed', label: 'Wrong Address' },
  '0011': { status: 'delivery_failed', label: 'Customer Refused' },
  '0012': { status: 'delivery_failed', label: 'Phone Unreachable' },
  '0013': { status: 'out_for_delivery', label: 'Out for Delivery' },
  '0014': { status: 'delivery_failed', label: 'Area Not Accessible' },
  '0015': { status: 'delivery_failed', label: 'COD Amount Disputed' },
  '0016': { status: 'delivery_failed', label: 'Consignee Requested Reschedule' },
  '0031': { status: 'in_transit', label: 'Departed to PostEx Warehouse' },
  '0033': { status: 'in_transit', label: 'En-Route to Destination' },
  '0035': { status: 'in_transit', label: 'Arrived at Transit Hub' },
  '0038': { status: 'out_for_delivery', label: 'Waiting for Delivery' },
  '0002': { status: 'returned', label: 'Returned to Merchant' },
  '0006': { status: 'returned', label: 'Returned' },
  '0007': { status: 'returned', label: 'Returned' }
};

function parsePostExResponse(data: any) {
  console.log('Parsing PostEx response:', JSON.stringify(data, null, 2));
  
  const history = data?.dist?.transactionStatusHistory || [];
  const statusHistory = history.map((event: any) => {
    const messageCode = event.transactionStatusMessageCode || '';
    const mapped = postexStatusMap[messageCode] || { status: 'in_transit', label: event.transactionStatusMessage };
    
    return {
      status: mapped.status,
      message: event.transactionStatusMessage || mapped.label,
      location: event.location || 'PostEx',
      timestamp: event.updatedAt || event.transactionDateTime || new Date().toISOString(),
      code: messageCode,
      raw: event
    };
  });

  // Get current status from the latest event
  const latestEvent = statusHistory[statusHistory.length - 1];
  const currentStatus = latestEvent?.status || 'in_transit';
  
  console.log(`Parsed ${statusHistory.length} tracking events. Current status: ${currentStatus}`);
  
  return {
    status: currentStatus,
    currentLocation: latestEvent?.location || 'In Transit',
    statusHistory,
    estimatedDelivery: data?.dist?.estimatedDelivery,
    raw: data
  };
}

async function trackWithCustomEndpoint(trackingId: string, courier: any, supabaseClient: any) {
  const courierCode = courier.code.toLowerCase();
  const apiKey = await getAPISetting(`${courier.code.toUpperCase()}_API_KEY`, supabaseClient);
  
  let url = courier.tracking_endpoint;
  let method = 'GET';
  let body = null;
  
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  // Leopard-specific handling
  if (courierCode === 'leopard') {
    console.log('[LEOPARD] Using POST body authentication for tracking');
    method = 'POST';
    
    const apiPassword = await getAPISetting('LEOPARD_API_PASSWORD', supabaseClient);
    if (!apiPassword) {
      throw new Error('Leopard API Password not configured. Please re-save your Leopard courier configuration in Business Settings > Couriers.');
    }
    
    body = JSON.stringify({
      api_key: apiKey,
      api_password: apiPassword,
      track_numbers: trackingId
    });
  } else if (courierCode === 'tcs') {
    // TCS docs show GET with body, but Deno fetch doesn't allow body on GET
    // Send consignee as query parameter instead
    console.log('[TCS] Using GET with query parameter for tracking');
    method = 'GET';
    headers['Authorization'] = `Bearer ${apiKey}`;
    headers['Content-Type'] = 'application/json';
    
    // Append consignee as query parameter
    url = `${url}?consignee=${trackingId}`;
    
    // No body for GET request
    body = null;
  } else {
    // Standard placeholder replacement for other couriers
    url = url.replace('{tracking_id}', trackingId);
    url = url.replace('{trackingId}', trackingId);
    url = url.replace('{trackingNumber}', trackingId);
    url = url.replace('{tracking_number}', trackingId);
    url = url.replace('{awb}', trackingId);
    url = url.replace('{AWB}', trackingId);
    
    // Apply authentication based on auth_type
    if (courier.auth_type === 'bearer_token') {
      headers['Authorization'] = `Bearer ${apiKey}`;
    } else if (courier.auth_type === 'api_key_header') {
      const headerName = courier.auth_config?.header_name || 'X-API-Key';
      headers[headerName] = apiKey || '';
    } else if (courier.auth_type === 'basic_auth') {
      const username = courier.auth_config?.username || '';
      const encoded = btoa(`${username}:${apiKey}`);
      headers['Authorization'] = `Basic ${encoded}`;
    }

    // Add custom headers if configured
    if (courier.auth_config?.custom_headers) {
      Object.assign(headers, courier.auth_config.custom_headers);
    }
  }
  
  console.log(`Tracking ${courier.name}:`, { method, url: url.substring(0, 100) });

  const response = await fetch(url, { 
    method,
    headers,
    ...(body && { body })
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`${courier.name} tracking failed:`, response.status, errorText);
    throw new Error(`${courier.name} tracking failed: ${response.statusText}`);
  }

  const data = await response.json();
  console.log('Raw tracking response:', JSON.stringify(data, null, 2));
  
  // Parse response based on courier type
  let trackingData;
  if (courier.code.toLowerCase() === 'postex') {
    trackingData = parsePostExResponse(data);
  } else if (courier.code.toLowerCase() === 'leopard') {
    trackingData = parseLeopardResponse(data);
  } else if (courier.code.toLowerCase() === 'tcs') {
    trackingData = parseTCSResponse(data);
  } else {
    // Generic parsing for other couriers
    trackingData = {
      status: data.status || 'in_transit',
      currentLocation: data.current_location || data.location,
      statusHistory: data.tracking_history || data.history || [],
      estimatedDelivery: data.estimated_delivery,
      raw: data
    };
  }

  // Get dispatch and order info
  const { data: dispatch, error: dispatchError } = await supabaseClient
    .from('dispatches')
    .select('id, order_id, courier_id')
    .eq('tracking_id', trackingId)
    .single();

  if (!dispatchError && dispatch) {
    console.log(`Found dispatch ${dispatch.id} for order ${dispatch.order_id}`);
    
    // Use courier.id if dispatch.courier_id is not set
    const courierId = dispatch.courier_id || courier.id;
    
    // Insert tracking events into courier_tracking_history
    for (const event of trackingData.statusHistory) {
      const { error: insertError } = await supabaseClient
        .from('courier_tracking_history')
        .upsert({
          dispatch_id: dispatch.id,
          order_id: dispatch.order_id,
          courier_id: courierId,
          tracking_id: trackingId,
          status: event.status,
          current_location: event.message || event.location,
          checked_at: event.timestamp || new Date().toISOString(),
          raw_response: event.raw || event
        }, {
          onConflict: 'tracking_id,checked_at,status',
          ignoreDuplicates: true
        });

      if (insertError) {
        console.error('Error inserting tracking event:', insertError);
      } else {
        console.log(`Inserted tracking event: ${event.status} at ${event.timestamp}`);
      }
    }
  } else {
    console.warn('Could not find dispatch for tracking ID:', trackingId, dispatchError);
  }
  
  return trackingData;
}

// Leopard response parser
function parseLeopardResponse(data: any) {
  console.log('[LEOPARD] Parsing tracking response:', JSON.stringify(data, null, 2));
  
  const packet = data.packet_list?.[0];
  if (!packet) {
    console.error('[LEOPARD] No packet data found in response');
    return {
      status: 'in_transit',
      currentLocation: 'Unknown',
      statusHistory: [],
      raw: data
    };
  }
  
  // Leopard API returns 'Tracking Detail' as the key
  const trackingDetail = packet['Tracking Detail'] || [];
  
  const statusHistory = trackingDetail.map((event: any) => {
    const mappedStatus = mapLeopardStatus(event.Status);
    
    // Leopard API uses underscores in field names: Activity_datetime, Activity_Date, Activity_Time
    // Build full timestamp from Activity_datetime or combine Activity_Date + Activity_Time
    let timestamp = event.Activity_datetime;
    if (!timestamp && event.Activity_Date) {
      timestamp = event.Activity_Time 
        ? `${event.Activity_Date} ${event.Activity_Time}`
        : event.Activity_Date;
    }
    if (!timestamp) {
      timestamp = new Date().toISOString();
    }
    
    return {
      status: mappedStatus,
      message: event.Status || 'Status Update',
      location: event.Reason || packet.destination_city_name || '',
      timestamp: timestamp,
      receiverName: event.Reciever_Name || event['Reciever Name'] || null,
      raw: event
    };
  });
  
  const currentStatus = statusHistory[statusHistory.length - 1]?.status || 'in_transit';
  
  console.log(`[LEOPARD] Parsed ${statusHistory.length} events. Current: ${currentStatus}`);
  
  return {
    status: currentStatus,
    currentLocation: packet.destination_city_name || 'In Transit',
    statusHistory,
    estimatedDelivery: null,
    raw: data
  };
}

function mapLeopardStatus(status: string): string {
  if (!status) return 'in_transit';
  const normalized = status.toUpperCase();
  
  // Check for keywords in status string
  if (normalized.includes('DELIVERED')) return 'delivered';
  if (normalized.includes('RETURN TO ORIGIN')) return 'returned';
  if (normalized.includes('RETURNED')) return 'returned';
  if (normalized.includes('READY FOR RETURN')) return 'delivery_failed';
  if (normalized.includes('OUT FOR DELIVERY')) return 'out_for_delivery';
  if (normalized.includes('ASSIGNED TO COURIER')) return 'out_for_delivery';
  if (normalized.includes('ARRIVED AT STATION')) return 'at_warehouse';
  if (normalized.includes('SHIPMENT PICKED')) return 'in_transit';
  if (normalized.includes('IN TRANSIT')) return 'in_transit';
  if (normalized.includes('ON THE WAY')) return 'in_transit';
  if (normalized.includes('DISPATCHED')) return 'in_transit';
  if (normalized.includes('BOOKED')) return 'booked';
  
  return 'in_transit';
}

// TCS response parser
function parseTCSResponse(data: any) {
  console.log('[TCS] Parsing tracking response:', JSON.stringify(data, null, 2));
  
  // TCS returns shipmentinfo and checkpoints at root level
  const shipment = data.shipmentinfo?.[0] || {};
  
  // TCS tracking events are in 'checkpoints' array, NOT 'deliveryinfo'
  const checkpoints = data.checkpoints || [];
  
  const statusHistory = checkpoints.map((event: any) => {
    const mappedStatus = mapTCSStatus(event.status);
    
    return {
      status: mappedStatus,
      message: event.status || 'Status Update',
      location: event.recievedby || '',  // TCS uses recievedby for location/receiver
      timestamp: parseTCSDateTime(event.datetime) || new Date().toISOString(),
      receivedBy: event.recievedby,
      raw: event
    };
  });
  
  // TCS returns checkpoints in reverse order (latest first), reverse for chronological
  statusHistory.reverse();
  
  const latestEvent = statusHistory[statusHistory.length - 1];
  const currentStatus = latestEvent?.status || 'in_transit';
  
  // Parse estimated delivery from shipmentsummary
  const estimatedDelivery = parseEstimatedDelivery(data.shipmentsummary);
  
  console.log(`[TCS] Parsed ${statusHistory.length} events. Current: ${currentStatus}`);
  
  return {
    status: currentStatus,
    currentLocation: latestEvent?.location || shipment.destination || 'In Transit',
    statusHistory,
    estimatedDelivery,
    raw: data
  };
}

// Helper to parse TCS datetime format "Friday Dec 5, 2025 21:05"
function parseTCSDateTime(datetime: string): string | null {
  if (!datetime) return null;
  try {
    // TCS format: "Friday Dec 5, 2025 21:05"
    const date = new Date(datetime.replace(/^[A-Za-z]+ /, '')); // Remove day name
    if (isNaN(date.getTime())) return datetime;
    return date.toISOString();
  } catch {
    return datetime;
  }
}

// Parse estimated delivery from shipmentsummary
function parseEstimatedDelivery(summary: string): string | null {
  if (!summary) return null;
  // Extract date from "Expected Delivery Date : 06-DEC-25 between 9 AM to 6 PM"
  const match = summary.match(/(\d{2}-[A-Z]{3}-\d{2})/);
  return match ? match[1] : null;
}

function mapTCSStatus(codeOrStatus: string): string {
  if (!codeOrStatus) return 'in_transit';
  const normalized = codeOrStatus.toUpperCase();
  
  // TCS status codes from documentation
  if (normalized === 'OK' || normalized.includes('DELIVERED')) return 'delivered';
  if (normalized === 'RO' || normalized.includes('RETURN')) return 'returned';
  if (normalized === 'SC') return 'at_warehouse';  // Awaiting Receiver Collection
  if (normalized.includes('OUT FOR DELIVERY') || normalized === 'DL') return 'out_for_delivery';
  if (normalized.includes('ARRIVED') || normalized.includes('RECEIVED')) return 'at_warehouse';
  if (normalized === 'PK' || normalized.includes('PICKED')) return 'in_transit';
  if (normalized.includes('BOOKED')) return 'booked';
  
  return 'in_transit';
}

function mapPostExStatus(status: string): string {
  const statusMap: Record<string, string> = {
    'BOOKED': 'booked',
    'IN_TRANSIT': 'in_transit',
    'OUT_FOR_DELIVERY': 'out_for_delivery',
    'DELIVERED': 'delivered',
    'RETURNED': 'returned'
  };
  return statusMap[status] || 'in_transit';
}
