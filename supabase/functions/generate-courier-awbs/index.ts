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

    // Get authenticated user from JWT token
    const authHeader = req.headers.get('Authorization');
    console.log('[AUTH] Authorization header present:', !!authHeader);
    
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    const token = authHeader.replace('Bearer', '').trim();
    if (!token) {
      throw new Error('No auth token provided');
    }

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError || !user) {
      console.error('[AUTH] Error:', userError);
      throw new Error('Not authenticated');
    }

    console.log(`[AUTH] Authenticated user: ${user.id}`);
    const { data: courier, error: courierError } = await supabaseClient
      .from('couriers')
      .select('*')
      .ilike('code', courier_code)
      .single();

    if (courierError || !courier) {
      console.error('Courier lookup error:', courierError);
      throw new Error(`Courier not found: ${courier_code}`);
    }

    console.log(`[COURIER] Found courier: ${courier.name} (${courier.code})`);

    // Get API settings for this courier
    const { data: apiSettings, error: settingsError } = await supabaseClient
      .from('api_settings')
      .select('setting_key, setting_value')
      .in('setting_key', [
        `${courier_code.toUpperCase()}_API_KEY`,
        `${courier_code.toUpperCase()}_AWB_ENDPOINT`
      ]);

    if (settingsError) {
      console.error('[SETTINGS] Error fetching API settings:', settingsError);
      throw new Error('Failed to fetch courier API settings');
    }

    console.log(`[SETTINGS] Retrieved ${apiSettings?.length || 0} settings`);

    const settingsMap = (apiSettings || []).reduce((acc, setting) => {
      acc[setting.setting_key] = setting.setting_value;
      return acc;
    }, {} as Record<string, string>);

    const apiKey = settingsMap[`${courier_code.toUpperCase()}_API_KEY`];
    const awbEndpoint = settingsMap[`${courier_code.toUpperCase()}_AWB_ENDPOINT`] || courier.api_endpoint;

    console.log('[SETTINGS] API Key present:', !!apiKey);
    console.log('[SETTINGS] AWB Endpoint:', awbEndpoint);

    if (!apiKey) {
      throw new Error(`API key not configured for ${courier_code}`);
    }

    // Create AWB record
    const { data: awbRecord, error: awbError } = await supabaseClient
      .from('courier_awbs')
      .insert({
        courier_code: courier.code,
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

    console.log(`[AWB] Processing ${batches.length} batches`);

    const allTrackingIds: string[] = [];
    const pdfBase64Data: string[] = [];
    let processedCount = 0;

    for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
      const batch = batches[batchIndex];
      console.log(`[AWB] Processing batch ${batchIndex + 1}/${batches.length} with ${batch.length} orders`);

      // Get dispatch records for this batch
      const { data: dispatches, error: dispatchError } = await supabaseClient
        .from('dispatches')
        .select('tracking_id, order_id')
        .in('order_id', batch)
        .ilike('courier', courier.code);

      if (dispatchError) {
        console.error(`[AWB] Error fetching dispatches for batch ${batchIndex + 1}:`, dispatchError);
        continue;
      }

      const trackingIds = dispatches?.map(d => d.tracking_id).filter(Boolean) || [];
      console.log(`[AWB] Found ${trackingIds.length} tracking IDs in batch ${batchIndex + 1}`);
      
      if (trackingIds.length === 0) {
        console.log(`[AWB] No tracking IDs found for batch ${batchIndex + 1}, skipping`);
        continue;
      }

      // Call courier API to generate AWB for this batch using GET endpoint
      try {
        const trackingNumbersParam = trackingIds.join(',');
        console.log(`[AWB] Calling API with tracking numbers: ${trackingNumbersParam}`);
        
        const awbResponse = await fetch(`${awbEndpoint}?trackingNumbers=${trackingNumbersParam}`, {
          method: 'GET',
          headers: {
            'token': apiKey
          }
        });

        console.log(`[AWB] API response status: ${awbResponse.status}`);
        console.log(`[AWB] API response content-type: ${awbResponse.headers.get('content-type')}`);

        if (!awbResponse.ok) {
          const errorText = await awbResponse.text();
          console.error(`[AWB] API error for batch ${batchIndex + 1}: ${awbResponse.status} ${awbResponse.statusText}`);
          console.error(`[AWB] Error response: ${errorText}`);
          continue;
        }

        // Get PDF as binary data
        const pdfArrayBuffer = await awbResponse.arrayBuffer();
        console.log(`[AWB] Received PDF of size: ${pdfArrayBuffer.byteLength} bytes`);
        
        if (pdfArrayBuffer.byteLength === 0) {
          console.error(`[AWB] Empty PDF received for batch ${batchIndex + 1}`);
          continue;
        }
        
        // Convert to base64
        const base64 = btoa(
          new Uint8Array(pdfArrayBuffer).reduce(
            (data, byte) => data + String.fromCharCode(byte),
            ''
          )
        );

        console.log(`[AWB] Converted to base64, length: ${base64.length}`);

        if (base64.length > 0) {
          pdfBase64Data.push(base64);
          allTrackingIds.push(...trackingIds);
          processedCount += batch.length;
          console.log(`[AWB] Successfully processed batch ${batchIndex + 1}`);
        } else {
          console.error(`[AWB] Failed to convert PDF to base64 for batch ${batchIndex + 1}`);
        }

      } catch (error) {
        console.error(`[AWB] Error calling AWB API for batch ${batchIndex + 1}:`, error);
        continue;
      }

      // Small delay between batches to avoid rate limiting
      if (batchIndex < batches.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }

    console.log(`[AWB] Processing complete. Generated ${pdfBase64Data.length} PDFs for ${allTrackingIds.length} tracking IDs`);

    // Update AWB record with results
    const updateData: any = {
      tracking_ids: allTrackingIds,
      status: pdfBase64Data.length > 0 ? 'completed' : 'failed',
      generated_at: new Date().toISOString()
    };

    if (pdfBase64Data.length === 1) {
      // Single PDF - store as base64 in pdf_data field
      updateData.pdf_data = pdfBase64Data[0];
      console.log(`[AWB] Storing single PDF, base64 length: ${pdfBase64Data[0].length}`);
    } else if (pdfBase64Data.length > 1) {
      // Multiple PDFs - store array of base64 strings
      updateData.pdf_data = JSON.stringify(pdfBase64Data);
      console.log(`[AWB] Storing ${pdfBase64Data.length} PDFs as JSON array`);
    } else {
      updateData.error_message = 'No AWBs were generated - all batches failed';
      console.error('[AWB] No PDFs generated from any batch');
    }

    console.log(`[AWB] Updating AWB record ${awbRecord.id} with status: ${updateData.status}`);
    
    const { data: updatedRecord, error: updateError } = await supabaseClient
      .from('courier_awbs')
      .update(updateData)
      .eq('id', awbRecord.id)
      .select()
      .single();

    if (updateError) {
      console.error('[AWB] Error updating AWB record:', updateError);
      throw new Error(`Failed to update AWB record: ${updateError.message}`);
    }

    console.log(`[AWB] Successfully updated record. Has pdf_data: ${!!updatedRecord.pdf_data}`);
    if (updatedRecord.pdf_data) {
      const pdfDataLength = typeof updatedRecord.pdf_data === 'string' 
        ? updatedRecord.pdf_data.length 
        : JSON.stringify(updatedRecord.pdf_data).length;
      console.log(`[AWB] PDF data length in updated record: ${pdfDataLength}`);
    }

    return new Response(
      JSON.stringify({
        success: true,
        awb_id: awbRecord.id,
        processed_count: processedCount,
        total_batches: batches.length,
        pdf_count: pdfBase64Data.length,
        tracking_ids: allTrackingIds,
        message: `Successfully generated ${pdfBase64Data.length} AWB PDF(s) for ${allTrackingIds.length} orders`
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