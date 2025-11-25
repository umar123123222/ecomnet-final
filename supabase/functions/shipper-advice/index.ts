import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ShipperAdviceRequest {
  trackingId: string;
  courierCode: string;
  adviceType: 'reattempt' | 'return' | 'reschedule';
  remarks?: string;
  rescheduleDate?: string;
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

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    const { data: { user } } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (!user) {
      throw new Error('Unauthorized');
    }

    const { trackingId, courierCode, adviceType, remarks, rescheduleDate }: ShipperAdviceRequest = await req.json();

    if (!trackingId || !courierCode || !adviceType) {
      throw new Error('Missing required fields');
    }

    console.log(`Processing shipper advice: ${adviceType} for tracking ${trackingId}`);

    // Find the order associated with this tracking ID
    const { data: dispatch } = await supabase
      .from('dispatches')
      .select('order_id, courier_id')
      .eq('tracking_id', trackingId)
      .single();

    if (!dispatch) {
      throw new Error('Order not found for this tracking ID');
    }

    // Fetch courier configuration
    const { data: courier, error: courierError } = await supabase
      .from('couriers')
      .select('*')
      .eq('code', courierCode)
      .eq('is_active', true)
      .single();

    if (courierError || !courier) {
      throw new Error(`Courier ${courierCode} not found or inactive`);
    }

    if (!courier.shipper_advice_save_endpoint) {
      throw new Error(`Courier ${courierCode} does not have a shipper advice endpoint configured`);
    }

    // Prepare headers for API call
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (courier.auth_type === 'bearer_token' && courier.auth_config?.api_key) {
      headers['Authorization'] = `Bearer ${courier.auth_config.api_key}`;
    } else if (courier.auth_type === 'api_key_header' && courier.auth_config?.api_key) {
      const headerName = courier.auth_config.header_name || 'X-API-KEY';
      headers[headerName] = courier.auth_config.api_key;
    } else if (courier.auth_type === 'basic_auth' && courier.auth_config?.username && courier.auth_config?.password) {
      const credentials = btoa(`${courier.auth_config.username}:${courier.auth_config.password}`);
      headers['Authorization'] = `Basic ${credentials}`;
    }

    // Prepare advice payload based on courier
    const advicePayload: any = {
      trackingNumber: trackingId,
      action: adviceType,
      remarks: remarks || '',
    };

    if (courier.code === 'leopard') {
      advicePayload.api_key = courier.auth_config?.api_key;
      advicePayload.api_password = courier.auth_config?.api_password;
    }

    if (adviceType === 'reschedule' && rescheduleDate) {
      advicePayload.rescheduleDate = rescheduleDate;
    }

    console.log('Calling shipper advice endpoint:', courier.shipper_advice_save_endpoint);

    // Call courier's shipper advice API
    const response = await fetch(courier.shipper_advice_save_endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify(advicePayload)
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Shipper advice API error:', errorText);
      throw new Error(`Shipper advice API failed: ${response.statusText}`);
    }

    const responseData = await response.json();

    // Store shipper advice log in database
    const { data: adviceLog, error: insertError } = await supabase
      .from('shipper_advice_logs')
      .insert({
        order_id: dispatch.order_id,
        tracking_id: trackingId,
        courier_id: courier.id,
        advice_type: adviceType,
        remarks: remarks,
        requested_by: user.id,
        courier_response: responseData,
        status: 'processed'
      })
      .select()
      .single();

    if (insertError) {
      console.error('Error storing shipper advice log:', insertError);
    }

    // Update order status if needed
    if (adviceType === 'return') {
      await supabase
        .from('orders')
        .update({ status: 'return_initiated' })
        .eq('id', dispatch.order_id);
    }

    return new Response(
      JSON.stringify({
        success: true,
        adviceLogId: adviceLog?.id,
        courierResponse: responseData,
        message: `Shipper advice (${adviceType}) saved successfully`
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Shipper advice error:', error);
    
    // Still log failed attempts
    try {
      const supabase = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
      );
      
      const authHeader = req.headers.get('Authorization');
      if (authHeader) {
        const { data: { user } } = await supabase.auth.getUser(
          authHeader.replace('Bearer ', '')
        );
        
        if (user) {
          const { trackingId, courierCode, adviceType, remarks } = await req.json();
          const { data: dispatch } = await supabase
            .from('dispatches')
            .select('order_id, courier_id')
            .eq('tracking_id', trackingId)
            .single();
            
          if (dispatch) {
            await supabase
              .from('shipper_advice_logs')
              .insert({
                order_id: dispatch.order_id,
                tracking_id: trackingId,
                courier_id: dispatch.courier_id,
                advice_type: adviceType,
                remarks: remarks,
                requested_by: user.id,
                status: 'failed',
                error_message: error.message
              });
          }
        }
      }
    } catch (logError) {
      console.error('Error logging failed advice:', logError);
    }
    
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    );
  }
});
