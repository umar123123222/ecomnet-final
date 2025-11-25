import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface FetchAWBRequest {
  trackingIds: string[];
  courierCode: string;
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

    const { trackingIds, courierCode }: FetchAWBRequest = await req.json();

    if (!trackingIds || trackingIds.length === 0 || !courierCode) {
      throw new Error('Missing required fields');
    }

    console.log(`Fetching AWBs for ${trackingIds.length} shipments from ${courierCode}`);

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

    if (!courier.awb_endpoint) {
      throw new Error(`Courier ${courierCode} does not have an AWB endpoint configured`);
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

    // Prepare AWB request payload based on courier
    let url = courier.awb_endpoint;
    let method = 'POST';
    let body: any = null;

    if (courier.code === 'postex') {
      // PostEx uses GET with query params
      method = 'GET';
      url = `${courier.awb_endpoint}?trackingNumbers=${trackingIds.join(',')}`;
    } else if (courier.code === 'leopard') {
      // Leopard uses POST
      body = {
        api_key: courier.auth_config?.api_key,
        api_password: courier.auth_config?.api_password,
        track_numbers: trackingIds
      };
    } else {
      // Generic approach
      body = { trackingIds };
    }

    console.log('Calling AWB endpoint:', url);

    const response = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('AWB API error:', errorText);
      throw new Error(`AWB API failed: ${response.statusText}`);
    }

    // Handle different response types
    const contentType = response.headers.get('content-type');
    let awbData = null;
    let awbUrl = null;

    if (contentType?.includes('application/pdf')) {
      // Direct PDF response
      const pdfBuffer = await response.arrayBuffer();
      const base64Pdf = btoa(String.fromCharCode(...new Uint8Array(pdfBuffer)));
      awbData = base64Pdf;
    } else if (contentType?.includes('application/json')) {
      // JSON response with URL or data
      const responseData = await response.json();
      
      if (responseData.pdf_url || responseData.url || responseData.invoice_url) {
        awbUrl = responseData.pdf_url || responseData.url || responseData.invoice_url;
      }
      
      if (responseData.pdf_data || responseData.data) {
        awbData = responseData.pdf_data || responseData.data;
      }
    }

    // Get order IDs for these tracking IDs
    const { data: dispatches } = await supabase
      .from('dispatches')
      .select('order_id')
      .in('tracking_id', trackingIds);

    const orderIds = dispatches?.map(d => d.order_id) || [];

    // Store AWB record in courier_awbs table
    const { data: awbRecord, error: insertError } = await supabase
      .from('courier_awbs')
      .insert({
        courier_code: courierCode,
        tracking_ids: trackingIds,
        order_ids: orderIds,
        total_orders: trackingIds.length,
        pdf_data: awbData,
        pdf_url: awbUrl,
        status: 'generated',
        generated_by: user.id
      })
      .select()
      .single();

    if (insertError) {
      console.error('Error storing AWB record:', insertError);
    }

    return new Response(
      JSON.stringify({
        success: true,
        awbId: awbRecord?.id,
        awbUrl,
        awbData,
        trackingCount: trackingIds.length,
        message: 'AWBs fetched successfully'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Fetch AWB error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    );
  }
});
