import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { PDFDocument, degrees } from 'https://esm.sh/pdf-lib@1.17.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * Extract individual PDF pages as separate base64 PDFs for HTML rendering
 * @param pdfBase64Array - Array of base64 encoded PDF strings
 * @returns Array of individual PDF pages as base64 strings
 */
async function extractIndividualPages(pdfBase64Array: string[]): Promise<string[]> {
  try {
    const individualPages: string[] = [];
    
    console.log(`[EXTRACT] Extracting individual pages from ${pdfBase64Array.length} PDF batches`);
    
    for (let batchIndex = 0; batchIndex < pdfBase64Array.length; batchIndex++) {
      const base64 = pdfBase64Array[batchIndex];
      
      // Convert base64 to Uint8Array
      const pdfBytes = Uint8Array.from(atob(base64), c => c.charCodeAt(0));
      
      // Load the PDF batch
      const sourcePdf = await PDFDocument.load(pdfBytes);
      const pageCount = sourcePdf.getPageCount();
      console.log(`[EXTRACT] Batch ${batchIndex + 1}: Extracting ${pageCount} pages`);
      
      // Extract each page as a separate PDF
      for (let pageIndex = 0; pageIndex < pageCount; pageIndex++) {
        const singlePagePdf = await PDFDocument.create();
        const [copiedPage] = await singlePagePdf.copyPages(sourcePdf, [pageIndex]);
        singlePagePdf.addPage(copiedPage);
        
        const singlePageBytes = await singlePagePdf.save();
        const singlePageBase64 = btoa(
          new Uint8Array(singlePageBytes).reduce(
            (data, byte) => data + String.fromCharCode(byte),
            ''
          )
        );
        
        individualPages.push(singlePageBase64);
      }
    }
    
    console.log(`[EXTRACT] Extracted ${individualPages.length} individual PDF pages`);
    return individualPages;
    
  } catch (error) {
    console.error('[EXTRACT] Error extracting individual pages:', error);
    throw error;
  }
}

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
    console.log('[AWB] Starting generation for courier:', courier_code);
    console.log('[AWB] Order IDs:', order_ids);

    // Get dispatches with tracking IDs for these orders
    const { data: dispatches, error: dispatchError } = await supabaseClient
      .from('dispatches')
      .select('id, tracking_id, order_id')
      .in('order_id', order_ids)
      .eq('courier_code', courier_code)
      .not('tracking_id', 'is', null);

    if (dispatchError) {
      console.error('[AWB] Error fetching dispatches:', dispatchError);
      throw dispatchError;
    }

    console.log(`[AWB] Found ${dispatches?.length || 0} dispatches with tracking IDs out of ${order_ids.length} orders`);

    if (!dispatches || dispatches.length === 0) {
      console.error('[AWB] No dispatches found with tracking IDs');
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'No dispatches found with tracking IDs for these orders',
          found: 0,
          requested: order_ids.length
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const trackingIds = dispatches.map(d => d.tracking_id);
    console.log(`[AWB] Processing ${trackingIds.length} tracking IDs:`, trackingIds);

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
        const totalLabels = allTrackingIds.length;
        const totalPages = Math.ceil(totalLabels / 3);
        console.log(`[AWB] Consolidating ${pdfBase64Data.length} PDF batches into ${totalPages} A4 pages (3 labels per page)...`);
        finalPdfData = await consolidateAWBs(pdfBase64Data);
        console.log(`[AWB] ✅ Consolidation complete: ${totalLabels} labels consolidated into ${totalPages} pages (base64 length: ${finalPdfData.length})`);
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

    // Extract individual pages for HTML rendering
    let individualPages: string[] = [];
    if (pdfBase64Data.length > 0) {
      try {
        console.log(`[AWB] Extracting individual pages for HTML rendering`);
        individualPages = await extractIndividualPages(pdfBase64Data);
        console.log(`[AWB] Successfully extracted ${individualPages.length} individual pages`);
      } catch (extractError) {
        console.error('[AWB] Error extracting individual pages:', extractError);
        // Continue without individual pages - HTML format will be unavailable
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
      
      // Store individual pages for HTML rendering
      if (individualPages.length > 0) {
        updateData.html_images = JSON.stringify(individualPages);
        console.log(`[AWB] Storing ${individualPages.length} individual pages for HTML format`);
      }
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

    const labelCount = allTrackingIds.length;
    const pageCount = Math.ceil(labelCount / 3);
    console.log(`[AWB] ✅ Generation complete: ${labelCount} labels, ${pageCount} pages`);

    return new Response(
      JSON.stringify({
        success: true,
        awb_id: awbRecord.id,
        processed_count: processedCount,
        total_batches: batches.length,
        pdf_count: pdfBase64Data.length,
        tracking_ids: allTrackingIds,
        stats: {
          total_labels: labelCount,
          total_pages: pageCount,
          labels_per_page: 3
        },
        message: `Successfully generated ${labelCount} label${labelCount !== 1 ? 's' : ''} (${pageCount} page${pageCount !== 1 ? 's' : ''})`
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