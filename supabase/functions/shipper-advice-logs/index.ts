import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface LogsRequest {
  courierCode?: string;
  trackingId?: string;
  dateFrom?: string;
  dateTo?: string;
  fetchFromCourier?: boolean;
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

    const { courierCode, trackingId, dateFrom, dateTo, fetchFromCourier }: LogsRequest = await req.json();

    // Build query for local logs
    let query = supabase
      .from('shipper_advice_logs')
      .select(`
        *,
        orders (order_number, customer_name),
        couriers (name, code),
        profiles (full_name)
      `)
      .order('requested_at', { ascending: false });

    if (courierCode) {
      const { data: courier } = await supabase
        .from('couriers')
        .select('id')
        .eq('code', courierCode)
        .single();
      
      if (courier) {
        query = query.eq('courier_id', courier.id);
      }
    }

    if (trackingId) {
      query = query.eq('tracking_id', trackingId);
    }

    if (dateFrom) {
      query = query.gte('requested_at', dateFrom);
    }

    if (dateTo) {
      query = query.lte('requested_at', dateTo);
    }

    const { data: localLogs, error: logsError } = await query;

    if (logsError) {
      throw logsError;
    }

    let courierLogs = null;

    // Optionally fetch from courier's API
    if (fetchFromCourier && courierCode) {
      const { data: courier } = await supabase
        .from('couriers')
        .select('*')
        .eq('code', courierCode)
        .eq('is_active', true)
        .single();

      if (courier && courier.shipper_advice_list_endpoint) {
        try {
          courierLogs = await fetchCourierLogs(courier, trackingId, dateFrom, dateTo);
        } catch (error) {
          console.error('Error fetching courier logs:', error);
          // Continue with local logs even if courier fetch fails
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        localLogs: localLogs || [],
        courierLogs: courierLogs,
        count: localLogs?.length || 0
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Shipper advice logs error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    );
  }
});

async function fetchCourierLogs(courier: any, trackingId?: string, dateFrom?: string, dateTo?: string) {
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

  let url = courier.shipper_advice_list_endpoint;

  // For Leopard, tracking ID is in URL path
  if (courier.code === 'leopard' && trackingId) {
    url = url.replace('{trackingNumber}', trackingId);
  }

  // For PostEx, tracking ID is in URL path
  if (courier.code === 'postex' && trackingId) {
    url = url.replace('{trackingNumber}', trackingId);
  }

  const payload: any = {};

  if (courier.code === 'leopard') {
    payload.api_key = courier.auth_config?.api_key;
    payload.api_password = courier.auth_config?.api_password;
    if (dateFrom) payload.dateFrom = dateFrom;
    if (dateTo) payload.dateTo = dateTo;
  }

  console.log('Fetching courier logs from:', url);

  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: Object.keys(payload).length > 0 ? JSON.stringify(payload) : undefined
  });

  if (!response.ok) {
    throw new Error(`Courier API failed: ${response.statusText}`);
  }

  return await response.json();
}
