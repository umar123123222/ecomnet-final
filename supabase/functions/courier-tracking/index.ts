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

    let trackingData;

    switch (courierCode.toUpperCase()) {
      case 'TCS':
        trackingData = await trackTCS(trackingId);
        break;
      
      case 'LEOPARD':
        trackingData = await trackLeopard(trackingId);
        break;
      
      case 'POSTEX':
        trackingData = await trackPostEx(trackingId);
        break;
      
      default:
        throw new Error(`Unsupported courier: ${courierCode}`);
    }

    // Update dispatch record with latest tracking info
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

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

async function trackTCS(trackingId: string) {
  const apiKey = await getAPISetting('TCS_API_KEY');
  
  const response = await fetch(`https://api.tcs.com.pk/api/v1/tracking/${trackingId}`, {
    headers: {
      'Authorization': `Bearer ${apiKey}`,
    },
  });

  if (!response.ok) {
    throw new Error('TCS tracking failed');
  }

  const data = await response.json();
  
  return {
    status: mapTCSStatus(data.status),
    currentLocation: data.current_location,
    statusHistory: data.tracking_history,
    estimatedDelivery: data.estimated_delivery,
    raw: data
  };
}

async function trackLeopard(trackingId: string) {
  const apiKey = await getAPISetting('LEOPARD_API_KEY');
  
  const response = await fetch(`https://api.leopardscourier.com/api/packet/track`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      track_numbers: [trackingId]
    }),
  });

  if (!response.ok) {
    throw new Error('Leopard tracking failed');
  }

  const data = await response.json();
  const shipment = data.packet_list[0];
  
  return {
    status: mapLeopardStatus(shipment.packet_status),
    currentLocation: shipment.location_name,
    statusHistory: shipment.packet_history,
    raw: data
  };
}

async function trackPostEx(trackingId: string) {
  const apiKey = await getAPISetting('POSTEX_API_KEY');
  
  const response = await fetch(`https://api.postex.pk/services/integration/api/order/v1/track-order/${trackingId}`, {
    headers: {
      'token': apiKey,
    },
  });

  if (!response.ok) {
    throw new Error('PostEx tracking failed');
  }

  const data = await response.json();
  
  return {
    status: mapPostExStatus(data.orderStatus),
    currentLocation: data.currentLocation,
    statusHistory: data.trackingHistory,
    raw: data
  };
}

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
