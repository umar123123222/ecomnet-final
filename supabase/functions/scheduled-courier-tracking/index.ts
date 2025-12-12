import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Optimized constants - reduced batch size to prevent timeouts
const BATCH_SIZE = 30;
const MAX_DISPATCHES_PER_RUN = 200; // Limit total dispatches per scheduled run
const MAX_AGE_DAYS = 7; // Only track orders from last 7 days

// Helper to get API setting
async function getAPISetting(supabase: any, key: string): Promise<string | null> {
  const { data } = await supabase
    .from('api_settings')
    .select('setting_value')
    .eq('setting_key', key)
    .single();
  return data?.setting_value || null;
}

// Direct tracking API call for Leopard
async function trackLeopard(trackingId: string, apiKey: string, apiPassword: string): Promise<any> {
  try {
    const response = await fetch('https://merchantapi.leopardscourier.com/api/trackBookedPacket/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ api_key: apiKey, api_password: apiPassword, track_numbers: trackingId })
    });
    const data = await response.json();
    if (data.status === 1 && data.packet_list?.[0]) {
      const packet = data.packet_list[0];
      const lastStatus = packet.Tracking_Detail?.[0];
      return {
        success: true,
        status: mapLeopardStatus(lastStatus?.Status || packet.booked_packet_status),
        location: lastStatus?.Location || packet.destination_city,
        raw: packet
      };
    }
    return { success: false, error: 'No tracking data' };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

// Direct tracking API call for PostEx
async function trackPostEx(trackingId: string, apiToken: string): Promise<any> {
  try {
    const response = await fetch(`https://api.postex.pk/services/integration/api/order/v3/track-order/${trackingId}`, {
      headers: { 'token': apiToken }
    });
    const data = await response.json();
    if (data.statusCode === '200' && data.dist) {
      return {
        success: true,
        status: mapPostExStatus(data.dist.orderStatus),
        location: data.dist.destinationCity,
        raw: data.dist
      };
    }
    return { success: false, error: data.message || 'No tracking data' };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

// Direct tracking API call for TCS
async function trackTCS(trackingId: string, accessToken: string): Promise<any> {
  try {
    const response = await fetch('https://devconnect.tcscourier.com/ecom/api/shipmentTracking/track', {
      method: 'GET',
      headers: { 
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ consignee: [trackingId] })
    });
    const data = await response.json();
    if (data.returnStatus?.status === 'SUCCESS' && data.TrackDetailReply?.[0]) {
      const tracking = data.TrackDetailReply[0];
      return {
        success: true,
        status: mapTCSStatus(tracking.status),
        location: tracking.currentLocation,
        raw: tracking
      };
    }
    return { success: false, error: 'No tracking data' };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

// Status mappers
function mapLeopardStatus(status: string): string {
  const lower = status?.toLowerCase() || '';
  if (lower.includes('delivered')) return 'delivered';
  if (lower.includes('return') || lower.includes('rto')) return 'returned';
  if (lower.includes('transit') || lower.includes('hub')) return 'in_transit';
  if (lower.includes('out for delivery')) return 'out_for_delivery';
  return 'in_transit';
}

function mapPostExStatus(status: string): string {
  const lower = status?.toLowerCase() || '';
  if (lower.includes('delivered')) return 'delivered';
  if (lower.includes('return') || lower.includes('rto')) return 'returned';
  if (lower.includes('out for delivery')) return 'out_for_delivery';
  return 'in_transit';
}

function mapTCSStatus(status: string): string {
  if (status === 'OK') return 'delivered';
  if (status === 'RO') return 'returned';
  return 'in_transit';
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    const body = await req.json().catch(() => ({}));
    const trigger = body.trigger || 'scheduled';
    
    console.log(`🔄 Starting optimized courier tracking (trigger: ${trigger})...`);
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get API credentials once (not per dispatch)
    const [leopardKey, leopardPassword, postexToken, tcsToken] = await Promise.all([
      getAPISetting(supabase, 'LEOPARD_API_KEY'),
      getAPISetting(supabase, 'LEOPARD_API_PASSWORD'),
      getAPISetting(supabase, 'POSTEX_API_TOKEN'),
      getAPISetting(supabase, 'TCS_ACCESS_TOKEN')
    ]);

    // Use optimized RPC to get only dispatches that need tracking
    // - Only dispatched orders (not delivered/returned)
    // - Last 7 days only
    // - Not tracked in last 4 hours
    const { data: dispatches, error: fetchError } = await supabase
      .rpc('get_dispatches_for_tracking', {
        p_limit: MAX_DISPATCHES_PER_RUN,
        p_max_age_days: MAX_AGE_DAYS
      });

    if (fetchError) {
      console.error('Error fetching dispatches:', fetchError);
      throw fetchError;
    }

    console.log(`📦 Processing ${dispatches?.length || 0} dispatches (max ${MAX_DISPATCHES_PER_RUN})`);

    const results = {
      total: dispatches?.length || 0,
      updated: 0,
      delivered: 0,
      returned: 0,
      failed: 0,
      skipped: 0,
      errors: [] as any[]
    };

    // Process in small batches to avoid timeouts
    for (let i = 0; i < (dispatches?.length || 0); i += BATCH_SIZE) {
      const batch = dispatches.slice(i, i + BATCH_SIZE);
      
      // Process batch in parallel
      const batchPromises = batch.map(async (dispatch: any) => {
        try {
          const courierCode = dispatch.courier_code?.toLowerCase();
          let trackingResult: any = null;

          // Direct API calls based on courier - NO edge function invocation
          if (courierCode === 'leopard' && leopardKey && leopardPassword) {
            trackingResult = await trackLeopard(dispatch.tracking_id, leopardKey, leopardPassword);
          } else if (courierCode === 'postex' && postexToken) {
            trackingResult = await trackPostEx(dispatch.tracking_id, postexToken);
          } else if (courierCode === 'tcs' && tcsToken) {
            trackingResult = await trackTCS(dispatch.tracking_id, tcsToken);
          } else {
            results.skipped++;
            return;
          }

          if (trackingResult?.success) {
            // Use RPC to update tracking (reduces multiple queries to one)
            const { data: updateResult } = await supabase.rpc('update_dispatch_tracking', {
              p_dispatch_id: dispatch.dispatch_id,
              p_status: trackingResult.status,
              p_location: trackingResult.location,
              p_raw_response: trackingResult.raw
            });

            if (updateResult?.changed) {
              results.updated++;
            }
            if (updateResult?.order_updated) {
              if (trackingResult.status === 'delivered') results.delivered++;
              if (trackingResult.status === 'returned') results.returned++;
            }
          } else {
            results.failed++;
          }
        } catch (error: any) {
          results.failed++;
          results.errors.push({
            dispatch_id: dispatch.dispatch_id,
            tracking_id: dispatch.tracking_id,
            error: error.message
          });
        }
      });

      await Promise.all(batchPromises);
      
      // Add small delay between batches to avoid rate limits
      if (i + BATCH_SIZE < (dispatches?.length || 0)) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }

    const duration = Date.now() - startTime;
    console.log(`✨ Tracking complete in ${duration}ms: updated=${results.updated}, delivered=${results.delivered}, returned=${results.returned}, skipped=${results.skipped}`);

    return new Response(
      JSON.stringify({
        success: true,
        duration_ms: duration,
        results
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error: any) {
    console.error('Error in scheduled-courier-tracking:', error);
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
