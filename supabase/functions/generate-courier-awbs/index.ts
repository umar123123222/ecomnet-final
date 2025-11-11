import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { PDFDocument, degrees } from 'https://esm.sh/pdf-lib@1.17.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * Consolidate multiple AWB PDFs into a single PDF with 3 AWBs per A4 sheet
 * @param pdfBase64Array - Array of base64 encoded PDF strings
 * @returns Consolidated PDF as base64 string
 */
async function consolidateAWBs(pdfBase64Array: string[]): Promise<string> {
  try {
    console.log(`[CONSOLIDATE] Starting consolidation of ${pdfBase64Array.length} PDF batches`);
    
    // Create a new PDF document for consolidated output
    const consolidatedPdf = await PDFDocument.create();
    
    // A4 dimensions in points (72 points = 1 inch)
    const A4_WIDTH = 595.28;
    const A4_HEIGHT = 841.89;
    const MARGIN = 10; // Small margin between AWBs
    const AWB_SLOT_HEIGHT = (A4_HEIGHT - (2 * MARGIN)) / 3; // Divide into 3 slots with margins
    
    let totalAwbsProcessed = 0;
    
    // Process each PDF batch (each batch contains AWBs from one API call)
    for (let batchIndex = 0; batchIndex < pdfBase64Array.length; batchIndex++) {
      const base64 = pdfBase64Array[batchIndex];
      
      // Convert base64 to Uint8Array
      const pdfBytes = Uint8Array.from(atob(base64), c => c.charCodeAt(0));
      
      // Load the PDF batch
      const sourcePdf = await PDFDocument.load(pdfBytes);
      const pageCount = sourcePdf.getPageCount();
      console.log(`[CONSOLIDATE] Batch ${batchIndex + 1}: Processing ${pageCount} AWB pages`);
      
      // Extract all pages from this batch
      for (let pageIndex = 0; pageIndex < pageCount; pageIndex++) {
        const awbPosition = totalAwbsProcessed % 3; // 0, 1, or 2 (top, middle, bottom)
        
        // Create a new A4 page when starting a new sheet (position 0)
        if (awbPosition === 0) {
          consolidatedPdf.addPage([A4_WIDTH, A4_HEIGHT]);
        }
        
        // Get the current page (last added page)
        const currentPage = consolidatedPdf.getPages()[consolidatedPdf.getPageCount() - 1];
        
        // Embed the AWB page from the source PDF
        const [embeddedPage] = await consolidatedPdf.embedPdf(sourcePdf, [pageIndex]);
        
        // Calculate scaling to fit the AWB into its slot while maintaining aspect ratio
        const awbWidth = embeddedPage.width;
        const awbHeight = embeddedPage.height;
        
        const scaleX = A4_WIDTH / awbWidth;
        const scaleY = AWB_SLOT_HEIGHT / awbHeight;
        const scale = Math.min(scaleX, scaleY); // Use smaller scale to ensure it fits
        
        const scaledWidth = awbWidth * scale;
        const scaledHeight = awbHeight * scale;
        
        // Center the AWB horizontally in its slot
        const xOffset = (A4_WIDTH - scaledWidth) / 2;
        
        // Calculate Y position based on slot (0 = top, 1 = middle, 2 = bottom)
        const yOffset = A4_HEIGHT - (awbPosition + 1) * AWB_SLOT_HEIGHT - MARGIN + (AWB_SLOT_HEIGHT - scaledHeight) / 2;
        
        // Draw the embedded AWB page
        currentPage.drawPage(embeddedPage, {
          x: xOffset,
          y: yOffset,
          width: scaledWidth,
          height: scaledHeight,
        });
        
        totalAwbsProcessed++;
      }
    }
    
    const finalPageCount = consolidatedPdf.getPageCount();
    const fullSheets = Math.floor(totalAwbsProcessed / 3);
    const partialAwbs = totalAwbsProcessed % 3;
    
    console.log(`[CONSOLIDATE] Consolidation complete: ${totalAwbsProcessed} AWBs consolidated into ${finalPageCount} sheets`);
    console.log(`[CONSOLIDATE] Layout: ${fullSheets} full sheets (3 AWBs each)${partialAwbs > 0 ? ` + 1 partial sheet (${partialAwbs} AWBs)` : ''}`);
    console.log(`[CONSOLIDATE] Paper saved: ${totalAwbsProcessed - finalPageCount} sheets (${Math.round((1 - finalPageCount/totalAwbsProcessed) * 100)}%)`);
    
    // Save the consolidated PDF and convert to base64
    const consolidatedBytes = await consolidatedPdf.save();
    const consolidatedBase64 = btoa(
      new Uint8Array(consolidatedBytes).reduce(
        (data, byte) => data + String.fromCharCode(byte),
        ''
      )
    );
    
    return consolidatedBase64;
    
  } catch (error) {
    console.error('[CONSOLIDATE] Error consolidating PDFs:', error);
    throw error;
  }
}

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

    // Consolidate PDFs if we have any (3 AWBs per sheet)
    let finalPdfData: string | null = null;
    
    if (pdfBase64Data.length > 0) {
      try {
        console.log(`[AWB] Consolidating ${pdfBase64Data.length} PDF batches into optimized sheets (3 AWBs per sheet)`);
        finalPdfData = await consolidateAWBs(pdfBase64Data);
        console.log(`[AWB] Successfully consolidated PDFs, final base64 length: ${finalPdfData.length}`);
      } catch (consolidateError) {
        console.error('[AWB] Error consolidating PDFs, falling back to original PDFs:', consolidateError);
        // Fallback: store multiple PDFs as before if consolidation fails
        if (pdfBase64Data.length === 1) {
          finalPdfData = pdfBase64Data[0];
        } else {
          finalPdfData = JSON.stringify(pdfBase64Data);
        }
      }
    }

    // Update AWB record with results
    const updateData: any = {
      tracking_ids: allTrackingIds,
      status: finalPdfData ? 'completed' : 'failed',
      generated_at: new Date().toISOString()
    };

    if (finalPdfData) {
      updateData.pdf_data = finalPdfData;
      console.log(`[AWB] Storing consolidated PDF, base64 length: ${finalPdfData.length}`);
    } else {
      updateData.error_message = 'No AWBs were generated - all batches failed';
      console.error('[AWB] No PDFs generated from any batch');
    }

    console.log(`[AWB] Updating AWB record ${awbRecord.id} with status: ${updateData.status}`);
    console.log(`[AWB] Update data:`, {
      status: updateData.status,
      tracking_ids_count: updateData.tracking_ids?.length || 0,
      has_pdf_data: !!updateData.pdf_data,
      pdf_data_length: updateData.pdf_data ? 
        (typeof updateData.pdf_data === 'string' ? updateData.pdf_data.length : 'object') : 0
    });
    
    const { error: updateError } = await supabaseClient
      .from('courier_awbs')
      .update(updateData)
      .eq('id', awbRecord.id);

    if (updateError) {
      console.error('[AWB] Error updating AWB record:', updateError);
      throw new Error(`Failed to update AWB record: ${updateError.message}`);
    }

    console.log(`[AWB] Successfully updated record ${awbRecord.id}`);

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