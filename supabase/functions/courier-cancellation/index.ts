import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.2";
import { getAPISetting } from "../_shared/apiSettings.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CancellationRequest {
  orderId: string;
  trackingId: string;
  reason?: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { orderId, trackingId, reason = 'Customer request' }: CancellationRequest = await req.json();
    console.log('Cancellation request:', { orderId, trackingId, reason });

    // Get order details
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('courier')
      .eq('id', orderId)
      .single();

    if (orderError || !order) {
      throw new Error('Order not found');
    }

    // Get courier details
    const { data: courier, error: courierError } = await supabase
      .from('couriers')
      .select('*')
      .eq('code', order.courier)
      .single();

    if (courierError || !courier) {
      console.warn('Courier not found, proceeding with database cleanup only');
    } else {
      const courierCode = (courier.code || '').toString().toUpperCase();
      
      // Try to cancel with courier API
      // For Postex, always attempt cancellation. For others, check if tracking endpoint exists
      if (courierCode === 'POSTEX' || courier.tracking_endpoint) {
        try {
          await cancelWithCourier(trackingId, courier, supabase, reason);
          console.log('Cancellation successful with courier API');
        } catch (error) {
          console.error('Courier API cancellation failed:', error);
          // Continue with database cleanup even if API call fails
        }
      }
    }

    // Delete dispatch records
    const { error: dispatchDeleteError } = await supabase
      .from('dispatches')
      .delete()
      .eq('order_id', orderId);

    if (dispatchDeleteError) {
      console.error('Error deleting dispatch:', dispatchDeleteError);
    }

    // Clear tracking ID and update order status
    const { error: orderUpdateError } = await supabase
      .from('orders')
      .update({
        tracking_id: null,
        courier: null,
        status: 'pending',
        updated_at: new Date().toISOString()
      })
      .eq('id', orderId);

    if (orderUpdateError) {
      throw orderUpdateError;
    }

    console.log('Order cancellation completed successfully');

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Courier booking cancelled and order reset successfully'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error: any) {
    console.error('Cancellation error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || 'Failed to cancel courier booking'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    );
  }
});

async function cancelWithCourier(
  trackingId: string,
  courier: any,
  supabaseClient: any,
  reason: string
) {
  const courierCode = (courier.code || '').toString().toUpperCase();
  console.log(`[CANCEL] Attempting to cancel with courier: ${courierCode}`);
  
  // Get API key
  const apiKey = await getAPISetting(`${courierCode}_API_KEY`, supabaseClient);
  if (!apiKey) {
    console.warn(`[CANCEL] No API key found for ${courierCode}, skipping API cancellation`);
    return { success: true, message: 'Cancelled locally (no API key)' };
  }

  let cancelEndpoint: string;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  let payload: any;

  // Configure cancellation based on courier type
  if (courierCode === 'POSTEX') {
    // Postex-specific configuration - use v1 API for cancellation with PUT method
    cancelEndpoint = 'https://api.postex.pk/services/integration/api/order/v1/cancel-order';
    
    headers['token'] = apiKey;
    payload = {
      trackingNumber: trackingId
    };
    
    console.log('[CANCEL] Using Postex cancellation:', { endpoint: cancelEndpoint, trackingNumber: trackingId, method: 'PUT' });
  } else if (courierCode === 'TCS' || courierCode === 'LEOPARD') {
    // TCS/Leopard-specific configuration (if they support cancellation)
    console.warn(`[CANCEL] ${courierCode} cancellation not implemented yet, proceeding with local cleanup`);
    return { success: true, message: `Cancelled locally (${courierCode} API cancellation not implemented)` };
  } else {
    // Generic courier cancellation
    cancelEndpoint = courier.tracking_endpoint?.replace('/track', '/cancel') 
      || courier.api_endpoint?.replace('/book', '/cancel')
      || `${courier.api_endpoint}/cancel`;
    
    // Apply generic auth
    if (courier.auth_type === 'bearer') {
      headers['Authorization'] = `Bearer ${apiKey}`;
    } else if (courier.auth_type === 'api_key') {
      headers['X-API-Key'] = apiKey;
      if (courier.auth_config?.header_name) {
        headers[courier.auth_config.header_name] = apiKey;
      }
    } else if (courier.auth_type === 'basic') {
      const credentials = btoa(`${courier.auth_config?.username || ''}:${apiKey}`);
      headers['Authorization'] = `Basic ${credentials}`;
    }
    
    payload = {
      tracking_id: trackingId,
      tracking_number: trackingId,
      cn_number: trackingId,
      awb_number: trackingId,
      reason: reason,
      cancel_reason: reason,
    };
    
    console.log('[CANCEL] Using generic cancellation:', { endpoint: cancelEndpoint });
  }

  try {
    // Use PUT method for Postex, POST for others
    const method = courierCode === 'POSTEX' ? 'PUT' : 'POST';
    
    const response = await fetch(cancelEndpoint, {
      method,
      headers,
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[CANCEL] ${courierCode} API error (${response.status}):`, errorText);
      console.warn('[CANCEL] Continuing with local cleanup despite API failure');
      return { success: true, message: `Cancelled locally (API error: ${response.status})` };
    }

    const result = await response.json();
    console.log(`[CANCEL] Successfully cancelled on ${courierCode} portal:`, result);
    return result;
  } catch (error: any) {
    console.error(`[CANCEL] ${courierCode} API exception:`, error.message);
    console.warn('[CANCEL] Continuing with local cleanup despite API exception');
    return { success: true, message: `Cancelled locally (API exception: ${error.message})` };
  }
}
