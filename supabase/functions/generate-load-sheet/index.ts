import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface LoadSheetRequest {
  courierCode: string;
  orderIds?: string[];
  trackingIds?: string[];
  dateFrom?: string;
  dateTo?: string;
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

    const { courierCode, orderIds, trackingIds, dateFrom, dateTo }: LoadSheetRequest = await req.json();

    if (!courierCode) {
      throw new Error('Courier code is required');
    }

    console.log(`Generating load sheet for courier: ${courierCode}`);

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

    if (!courier.load_sheet_endpoint) {
      throw new Error(`Courier ${courierCode} does not have a load sheet endpoint configured`);
    }

    // Gather tracking IDs and order IDs
    let finalTrackingIds = trackingIds || [];
    let finalOrderIds = orderIds || [];

    // If date range provided, fetch orders from that range
    if (dateFrom && dateTo && !trackingIds && !orderIds) {
      const { data: dispatches } = await supabase
        .from('dispatches')
        .select('tracking_id, order_id, courier')
        .eq('courier', courierCode)
        .gte('dispatch_date', dateFrom)
        .lte('dispatch_date', dateTo)
        .not('tracking_id', 'is', null);

      if (dispatches && dispatches.length > 0) {
        finalTrackingIds = dispatches.map(d => d.tracking_id).filter(Boolean);
        finalOrderIds = dispatches.map(d => d.order_id);
      }
    } else if (orderIds && orderIds.length > 0) {
      // Fetch tracking IDs for provided order IDs
      const { data: dispatches } = await supabase
        .from('dispatches')
        .select('tracking_id, order_id')
        .in('order_id', orderIds)
        .not('tracking_id', 'is', null);

      if (dispatches && dispatches.length > 0) {
        finalTrackingIds = dispatches.map(d => d.tracking_id).filter(Boolean);
      }
    }

    if (finalTrackingIds.length === 0) {
      throw new Error('No tracking IDs found for load sheet generation');
    }

    console.log(`Generating load sheet for ${finalTrackingIds.length} shipments`);

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

    // Call courier's load sheet API
    const loadSheetPayload: any = {
      trackingNumbers: finalTrackingIds,
    };

    // Add courier-specific fields
    if (courier.code === 'leopard') {
      loadSheetPayload.api_key = courier.auth_config?.api_key;
      loadSheetPayload.api_password = courier.auth_config?.api_password;
    }

    console.log('Calling load sheet endpoint:', courier.load_sheet_endpoint);

    const response = await fetch(courier.load_sheet_endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify(loadSheetPayload)
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Load sheet API error:', errorText);
      throw new Error(`Load sheet API failed: ${response.statusText}`);
    }

    const responseData = await response.json();
    
    // Extract load sheet URL or data based on courier response format
    let loadSheetUrl = null;
    let loadSheetData = null;

    if (responseData.load_sheet_url || responseData.url || responseData.pdf_url) {
      loadSheetUrl = responseData.load_sheet_url || responseData.url || responseData.pdf_url;
    }

    if (responseData.pdf_data || responseData.data) {
      loadSheetData = responseData.pdf_data || responseData.data;
    }

    // Store load sheet record in database
    const { data: loadSheet, error: insertError } = await supabase
      .from('courier_load_sheets')
      .insert({
        courier_id: courier.id,
        generated_by: user.id,
        tracking_ids: finalTrackingIds,
        order_ids: finalOrderIds,
        load_sheet_url: loadSheetUrl,
        load_sheet_data: loadSheetData,
        status: 'generated'
      })
      .select()
      .single();

    if (insertError) {
      console.error('Error storing load sheet:', insertError);
    }

    return new Response(
      JSON.stringify({
        success: true,
        loadSheetId: loadSheet?.id,
        loadSheetUrl,
        loadSheetData,
        trackingCount: finalTrackingIds.length,
        courierResponse: responseData
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Load sheet generation error:', error);
    
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    );
  }
});
