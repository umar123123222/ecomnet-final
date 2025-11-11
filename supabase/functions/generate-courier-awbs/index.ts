import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    );

    const { courier_code, order_ids } = await req.json();

    if (!courier_code || !order_ids || order_ids.length === 0) {
      throw new Error('Missing courier_code or order_ids');
    }

    console.log(`Generating AWBs for ${courier_code} with ${order_ids.length} orders`);

    // Get courier configuration
    const { data: courier, error: courierError } = await supabaseClient
      .from('couriers')
      .select('*')
      .eq('code', courier_code.toUpperCase())
      .single();

    if (courierError || !courier) {
      throw new Error(`Courier not found: ${courier_code}`);
    }

    // Get API settings for this courier
    const { data: apiSettings, error: settingsError } = await supabaseClient
      .from('api_settings')
      .select('setting_key, setting_value')
      .in('setting_key', [
        `${courier_code.toUpperCase()}_API_KEY`,
        `${courier_code.toUpperCase()}_AWB_ENDPOINT`
      ]);

    if (settingsError) {
      console.error('Error fetching API settings:', settingsError);
      throw new Error('Failed to fetch courier API settings');
    }

    const settingsMap = (apiSettings || []).reduce((acc, setting) => {
      acc[setting.setting_key] = setting.setting_value;
      return acc;
    }, {} as Record<string, string>);

    const apiKey = settingsMap[`${courier_code.toUpperCase()}_API_KEY`];
    const awbEndpoint = settingsMap[`${courier_code.toUpperCase()}_AWB_ENDPOINT`] || courier.api_endpoint;

    if (!apiKey) {
      throw new Error(`API key not configured for ${courier_code}`);
    }

    // Get user ID
    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) {
      throw new Error('Not authenticated');
    }

    // Create AWB record
    const { data: awbRecord, error: awbError } = await supabaseClient
      .from('courier_awbs')
      .insert({
        courier_code: courier_code.toUpperCase(),
        order_ids: order_ids,
        tracking_ids: [],
        generated_by: user.id,
        status: 'processing',
        total_orders: order_ids.length,
        batch_count: Math.ceil(order_ids.length / 10)
      })
      .select()
      .single();

    if (awbError || !awbRecord) {
      console.error('Error creating AWB record:', awbError);
      throw new Error('Failed to create AWB record');
    }

    // Process in batches of 10 (PostEx limit)
    const batchSize = 10;
    const batches = [];
    for (let i = 0; i < order_ids.length; i += batchSize) {
      batches.push(order_ids.slice(i, i + batchSize));
    }

    console.log(`Processing ${batches.length} batches`);

    const allTrackingIds: string[] = [];
    const pdfUrls: string[] = [];
    let processedCount = 0;

    for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
      const batch = batches[batchIndex];
      console.log(`Processing batch ${batchIndex + 1}/${batches.length} with ${batch.length} orders`);

      // Get dispatch records for this batch
      const { data: dispatches, error: dispatchError } = await supabaseClient
        .from('dispatches')
        .select('tracking_id, order_id')
        .in('order_id', batch)
        .eq('courier', courier_code.toUpperCase());

      if (dispatchError) {
        console.error(`Error fetching dispatches for batch ${batchIndex + 1}:`, dispatchError);
        continue;
      }

      const trackingIds = dispatches?.map(d => d.tracking_id).filter(Boolean) || [];
      
      if (trackingIds.length === 0) {
        console.log(`No tracking IDs found for batch ${batchIndex + 1}`);
        continue;
      }

      // Call courier API to generate AWB for this batch
      try {
        const awbResponse = await fetch(awbEndpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'token': apiKey
          },
          body: JSON.stringify({
            orderRefNumber: trackingIds
          })
        });

        const awbData = await awbResponse.json();

        if (!awbResponse.ok || awbData.dist?.status !== 200) {
          console.error(`AWB generation failed for batch ${batchIndex + 1}:`, awbData);
          continue;
        }

        // Extract PDF URL from response
        if (awbData.dist?.awbFile) {
          pdfUrls.push(awbData.dist.awbFile);
          allTrackingIds.push(...trackingIds);
        }

        processedCount += batch.length;

      } catch (error) {
        console.error(`Error calling AWB API for batch ${batchIndex + 1}:`, error);
        continue;
      }

      // Small delay between batches to avoid rate limiting
      if (batchIndex < batches.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }

    // Update AWB record with results
    const updateData: any = {
      tracking_ids: allTrackingIds,
      status: pdfUrls.length > 0 ? 'completed' : 'failed',
      generated_at: new Date().toISOString()
    };

    if (pdfUrls.length === 1) {
      updateData.pdf_url = pdfUrls[0];
    } else if (pdfUrls.length > 1) {
      // For multiple PDFs, store all URLs
      updateData.pdf_data = JSON.stringify(pdfUrls);
    } else {
      updateData.error_message = 'No AWBs were generated';
    }

    const { error: updateError } = await supabaseClient
      .from('courier_awbs')
      .update(updateData)
      .eq('id', awbRecord.id);

    if (updateError) {
      console.error('Error updating AWB record:', updateError);
    }

    return new Response(
      JSON.stringify({
        success: true,
        awb_id: awbRecord.id,
        processed_count: processedCount,
        total_batches: batches.length,
        pdf_urls: pdfUrls,
        tracking_ids: allTrackingIds,
        message: `Successfully generated ${pdfUrls.length} AWB(s) for ${allTrackingIds.length} orders`
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error) {
    console.error('Error in generate-courier-awbs:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});