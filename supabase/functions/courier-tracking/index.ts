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

async function trackWithCustomEndpoint(trackingId: string, courier: any, supabaseClient: any) {
  const apiKey = await getAPISetting(`${courier.code.toUpperCase()}_API_KEY`, supabaseClient);
  
  // Support multiple placeholder formats for different courier APIs
  let url = courier.tracking_endpoint;
  url = url.replace('{tracking_id}', trackingId);
  url = url.replace('{trackingId}', trackingId);
  url = url.replace('{trackingNumber}', trackingId);
  url = url.replace('{tracking_number}', trackingId);
  url = url.replace('{awb}', trackingId);
  url = url.replace('{AWB}', trackingId);
  
  console.log('Tracking URL after replacement:', url);
  
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

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

  const response = await fetch(url, { headers });

  if (!response.ok) {
    throw new Error(`${courier.name} tracking failed: ${response.statusText}`);
  }

  const data = await response.json();
  
  return {
    status: data.status || 'in_transit',
    currentLocation: data.current_location || data.location,
    statusHistory: data.tracking_history || data.history || [],
    estimatedDelivery: data.estimated_delivery,
    raw: data
  };
}

// Legacy hardcoded functions removed - all couriers must now use configured tracking_endpoint

function mapTCSStatus(status: string): string {
  const statusMap: Record<string, string> = {
    'BOOKED': 'booked',
    'IN_TRANSIT': 'in_transit',
    'OUT_FOR_DELIVERY': 'out_for_delivery',
    'DELIVERED': 'delivered',
    'RETURNED': 'returned'
  };
  return statusMap[status] || 'in_transit';
}

function mapLeopardStatus(status: string): string {
  const statusMap: Record<string, string> = {
    'BOOKED': 'booked',
    'DISPATCHED': 'in_transit',
    'IN TRANSIT': 'in_transit',
    'OUT FOR DELIVERY': 'out_for_delivery',
    'DELIVERED': 'delivered',
    'RETURNED': 'returned'
  };
  return statusMap[status] || 'in_transit';
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
