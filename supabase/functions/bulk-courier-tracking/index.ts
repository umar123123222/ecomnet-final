import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getAPISetting } from "../_shared/apiSettings.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface BulkTrackingRequest {
  trackingIds: string[];
  courierCode?: string;
}

interface TrackingResult {
  trackingId: string;
  status: 'success' | 'failed';
  data?: any;
  error?: string;
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

    const { trackingIds, courierCode }: BulkTrackingRequest = await req.json();

    if (!trackingIds || trackingIds.length === 0) {
      throw new Error('No tracking IDs provided');
    }

    console.log(`Processing bulk tracking for ${trackingIds.length} shipments`);

    const results: TrackingResult[] = [];

    // Group tracking IDs by courier if not specified
    const trackingGroups = new Map<string, string[]>();
    
    if (courierCode) {
      trackingGroups.set(courierCode, trackingIds);
    } else {
      // Find courier for each tracking ID from dispatches table
      for (const trackingId of trackingIds) {
        const { data: dispatch } = await supabase
          .from('dispatches')
          .select('courier')
          .eq('tracking_id', trackingId)
          .single();
        
        if (dispatch?.courier) {
          const group = trackingGroups.get(dispatch.courier) || [];
          group.push(trackingId);
          trackingGroups.set(dispatch.courier, group);
        }
      }
    }

    // Process each courier group
    for (const [courier, ids] of trackingGroups.entries()) {
      const { data: courierData } = await supabase
        .from('couriers')
        .select('*')
        .eq('code', courier)
        .eq('is_active', true)
        .single();

      if (!courierData) {
        ids.forEach(id => {
          results.push({
            trackingId: id,
            status: 'failed',
            error: `Courier ${courier} not found or inactive`
          });
        });
        continue;
      }

      // Check if courier has bulk tracking endpoint
      if (courierData.bulk_tracking_endpoint) {
        try {
          const bulkResult = await trackBulkWithEndpoint(courierData, ids, supabase);
          results.push(...bulkResult);
        } catch (error) {
          console.error(`Bulk tracking failed for ${courier}:`, error);
          // Fallback to individual tracking
          for (const trackingId of ids) {
            const result = await trackIndividually(supabase, courierData, trackingId);
            results.push(result);
          }
        }
      } else {
        // No bulk endpoint, track individually
        for (const trackingId of ids) {
          const result = await trackIndividually(supabase, courierData, trackingId);
          results.push(result);
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        total: trackingIds.length,
        successful: results.filter(r => r.status === 'success').length,
        failed: results.filter(r => r.status === 'failed').length,
        results
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Bulk tracking error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    );
  }
});

async function trackBulkWithEndpoint(courier: any, trackingIds: string[], supabaseClient: any): Promise<TrackingResult[]> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  // Get API key from api_settings table
  const apiKey = await getAPISetting(`${courier.code.toUpperCase()}_API_KEY`, supabaseClient);

  // Set authentication headers based on courier config
  if (courier.auth_type === 'bearer_token' && apiKey) {
    headers['Authorization'] = `Bearer ${apiKey}`;
  } else if (courier.auth_type === 'api_key_header' && apiKey) {
    const headerName = courier.auth_config?.header_name || 'X-API-KEY';
    headers[headerName] = apiKey;
  }

  console.log(`Calling bulk tracking endpoint: ${courier.bulk_tracking_endpoint}`);

  const response = await fetch(courier.bulk_tracking_endpoint, {
    method: 'POST',
    headers,
    body: JSON.stringify({ trackingIds })
  });

  if (!response.ok) {
    throw new Error(`Bulk tracking API failed: ${response.statusText}`);
  }

  const data = await response.json();
  
  // Parse response and map to TrackingResult format
  return trackingIds.map(id => ({
    trackingId: id,
    status: 'success',
    data: data[id] || data
  }));
}

async function trackIndividually(supabase: any, courier: any, trackingId: string): Promise<TrackingResult> {
  try {
    const { data, error } = await supabase.functions.invoke('courier-tracking', {
      body: { trackingId, courierCode: courier.code }
    });

    if (error) throw error;

    return {
      trackingId,
      status: 'success',
      data
    };
  } catch (error) {
    return {
      trackingId,
      status: 'failed',
      error: error.message
    };
  }
}
