import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.2';
import { PDFDocument } from 'https://esm.sh/pdf-lib@1.17.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// A4 dimensions in points
const A4_WIDTH = 595.28;
const A4_HEIGHT = 841.89;
const MARGIN = 10;

interface BulkPrintRequest {
  order_ids: string[];
  courier_code: string;
  labels_per_page?: 2 | 3;
}

interface PrintResult {
  order_id: string;
  tracking_id: string;
  success: boolean;
  error?: string;
}

/**
 * Fetch with exponential backoff retry
 */
async function fetchWithRetry(
  fn: () => Promise<Response>,
  maxRetries: number = 3
): Promise<Response> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await fn();
      if (response.ok) return response;

      if (response.status === 429 || response.status >= 500) {
        const delay = Math.pow(2, attempt) * 1000;
        console.log(`[RETRY] Attempt ${attempt} failed with ${response.status}, retrying in ${delay}ms`);
        await new Promise(r => setTimeout(r, delay));
        continue;
      }
      return response; // Return non-retryable errors immediately
    } catch (e) {
      if (attempt === maxRetries) throw e;
      const delay = Math.pow(2, attempt) * 1000;
      console.log(`[RETRY] Attempt ${attempt} threw error, retrying in ${delay}ms:`, e);
      await new Promise(r => setTimeout(r, delay));
    }
  }
  throw new Error('Max retries exceeded');
}

/**
 * Get API setting from database
 */
async function getAPISetting(key: string, supabase: any): Promise<string | null> {
  const { data } = await supabase
    .from('api_settings')
    .select('setting_value')
    .eq('setting_key', key)
    .single();
  return data?.setting_value || null;
}

/**
 * Consolidate multiple PDF labels into 3-per-A4-page layout
 */
async function consolidateLabels(
  pdfBuffers: ArrayBuffer[],
  labelsPerPage: number = 3
): Promise<Uint8Array> {
  const consolidatedPdf = await PDFDocument.create();
  const slotHeight = (A4_HEIGHT - 2 * MARGIN) / labelsPerPage;

  let currentPage: any = null;
  let slot = 0;

  for (const buffer of pdfBuffers) {
    try {
      const sourcePdf = await PDFDocument.load(buffer);
      const pageCount = sourcePdf.getPageCount();

      for (let i = 0; i < pageCount; i++) {
        if (slot % labelsPerPage === 0) {
          currentPage = consolidatedPdf.addPage([A4_WIDTH, A4_HEIGHT]);
          slot = 0;
        }

        const [embeddedPage] = await consolidatedPdf.embedPdf(sourcePdf, [i]);

        // Calculate scaling to fit in slot
        const scaleX = (A4_WIDTH - 2 * MARGIN) / embeddedPage.width;
        const scaleY = slotHeight / embeddedPage.height;
        const scale = Math.min(scaleX, scaleY, 1); // Don't upscale

        const scaledWidth = embeddedPage.width * scale;
        const scaledHeight = embeddedPage.height * scale;

        // Position: top slot = 0, middle slot = 1, bottom slot = 2
        const xOffset = (A4_WIDTH - scaledWidth) / 2;
        const yOffset = A4_HEIGHT - (slot + 1) * slotHeight - MARGIN + (slotHeight - scaledHeight) / 2;

        currentPage.drawPage(embeddedPage, {
          x: xOffset,
          y: yOffset,
          width: scaledWidth,
          height: scaledHeight,
        });

        slot++;
      }
    } catch (err) {
      console.error('[CONSOLIDATE] Error processing PDF:', err);
      // Continue with remaining PDFs
    }
  }

  return await consolidatedPdf.save();
}

/**
 * Fetch label for a single tracking ID from courier API
 */
async function fetchSingleLabel(
  trackingId: string,
  courier: any,
  apiKey: string
): Promise<ArrayBuffer | null> {
  const courierCode = courier.code?.toUpperCase();

  try {
    if (courierCode === 'POSTEX') {
      const endpoint = courier.awb_endpoint || 'https://api.postex.pk/services/integration/api/order/v1/get-invoice';
      const response = await fetchWithRetry(() =>
        fetch(`${endpoint}?trackingNumbers=${trackingId}`, {
          method: 'GET',
          headers: { 'token': apiKey }
        })
      );
      if (!response.ok) return null;
      return await response.arrayBuffer();

    } else if (courierCode === 'TCS') {
      const endpoint = courier.awb_endpoint;
      if (!endpoint) return null;
      
      // TCS uses Printtype=4 for 3-per-page native support
      const response = await fetchWithRetry(() =>
        fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            TrackingNumber: trackingId,
            Printtype: 4 // Native 3 labels per page
          })
        })
      );
      if (!response.ok) return null;
      return await response.arrayBuffer();

    } else if (courierCode === 'LEOPARD') {
      const endpoint = courier.awb_endpoint;
      const apiPassword = await getAPISetting('LEOPARD_API_PASSWORD', null);
      if (!endpoint) return null;

      const response = await fetchWithRetry(() =>
        fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            api_key: apiKey,
            api_password: apiPassword,
            track_numbers: trackingId
          })
        })
      );
      if (!response.ok) return null;
      return await response.arrayBuffer();
    }

    return null;
  } catch (err) {
    console.error(`[FETCH] Error fetching label for ${trackingId}:`, err);
    return null;
  }
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

    const token = authHeader.replace('Bearer ', '').trim();
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    if (userError || !user) {
      throw new Error('Not authenticated');
    }

    const { order_ids, courier_code, labels_per_page = 3 }: BulkPrintRequest = await req.json();

    if (!courier_code || !order_ids || order_ids.length === 0) {
      throw new Error('Missing courier_code or order_ids');
    }

    console.log(`[BULK-PRINT] Starting for ${order_ids.length} orders, courier: ${courier_code}`);

    // Get courier details - use eq() instead of ilike() for text columns
    const normalizedCourierCode = courier_code.toLowerCase();
    const { data: courier, error: courierError } = await supabase
      .from('couriers')
      .select('*')
      .eq('code', normalizedCourierCode)
      .single();

    if (courierError || !courier) {
      throw new Error(`Courier not found: ${courier_code}`);
    }

    const printConfig = courier.print_config || {};
    console.log('[BULK-PRINT] Courier print_config:', printConfig);

    // Get dispatches with their label info - use eq() for ENUM courier column
    const { data: dispatches, error: dispatchError } = await supabase
      .from('dispatches')
      .select('id, order_id, tracking_id, label_storage_path, label_data, label_url')
      .in('order_id', order_ids)
      .eq('courier', normalizedCourierCode);

    if (dispatchError) {
      throw dispatchError;
    }

    if (!dispatches || dispatches.length === 0) {
      return new Response(
        JSON.stringify({ success: false, error: 'No dispatches found for these orders' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[BULK-PRINT] Found ${dispatches.length} dispatches`);

    // Get API key for this courier
    const apiKey = await getAPISetting(`${courier_code.toUpperCase()}_API_KEY`, supabase);
    if (!apiKey) {
      throw new Error(`API key not configured for ${courier_code}`);
    }

    const results: PrintResult[] = [];
    const pdfBuffers: ArrayBuffer[] = [];

    // Categorize dispatches: has cached label vs needs fetch
    const hasCachedLabel = dispatches.filter(d => d.label_storage_path);
    const needsFetch = dispatches.filter(d => !d.label_storage_path && d.tracking_id);

    console.log(`[BULK-PRINT] ${hasCachedLabel.length} cached, ${needsFetch.length} need fetch`);

    // 1. Download cached labels from storage
    for (const dispatch of hasCachedLabel) {
      try {
        const { data: labelData, error: downloadError } = await supabase.storage
          .from('courier-labels')
          .download(dispatch.label_storage_path);

        if (downloadError || !labelData) {
          console.error(`[BULK-PRINT] Failed to download cached label:`, downloadError);
          results.push({
            order_id: dispatch.order_id,
            tracking_id: dispatch.tracking_id,
            success: false,
            error: 'Failed to download cached label'
          });
          continue;
        }

        const buffer = await labelData.arrayBuffer();
        pdfBuffers.push(buffer);
        results.push({
          order_id: dispatch.order_id,
          tracking_id: dispatch.tracking_id,
          success: true
        });
      } catch (err: any) {
        results.push({
          order_id: dispatch.order_id,
          tracking_id: dispatch.tracking_id,
          success: false,
          error: err.message
        });
      }
    }

    // 2. Fetch missing labels with courier-specific batching
    if (needsFetch.length > 0) {
      const maxPerRequest = printConfig.max_tracking_per_request || 10;
      const rateDelayMs = printConfig.rate_limit_delay_ms || 500;

      // Batch tracking IDs
      const trackingIds = needsFetch.map(d => d.tracking_id).filter(Boolean);
      const batches: string[][] = [];
      for (let i = 0; i < trackingIds.length; i += maxPerRequest) {
        batches.push(trackingIds.slice(i, i + maxPerRequest));
      }

      console.log(`[BULK-PRINT] Fetching in ${batches.length} batches (max ${maxPerRequest} per request)`);

      for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
        const batch = batches[batchIndex];
        console.log(`[BULK-PRINT] Processing batch ${batchIndex + 1}/${batches.length}`);

        try {
          const courierCode = courier.code?.toUpperCase();

          if (courierCode === 'POSTEX') {
            // PostEx supports bulk fetch with comma-separated tracking numbers
            const endpoint = courier.awb_endpoint || 'https://api.postex.pk/services/integration/api/order/v1/get-invoice';
            const response = await fetchWithRetry(() =>
              fetch(`${endpoint}?trackingNumbers=${batch.join(',')}`, {
                method: 'GET',
                headers: { 'token': apiKey }
              })
            );

            if (response.ok) {
              const buffer = await response.arrayBuffer();
              pdfBuffers.push(buffer);
              batch.forEach(tid => {
                const dispatch = needsFetch.find(d => d.tracking_id === tid);
                if (dispatch) {
                  results.push({ order_id: dispatch.order_id, tracking_id: tid, success: true });
                }
              });
            } else {
              const errorText = await response.text();
              console.error(`[BULK-PRINT] PostEx API error:`, errorText);
              batch.forEach(tid => {
                const dispatch = needsFetch.find(d => d.tracking_id === tid);
                if (dispatch) {
                  results.push({ order_id: dispatch.order_id, tracking_id: tid, success: false, error: 'API error' });
                }
              });
            }
          } else {
            // For other couriers, fetch individually
            for (const tid of batch) {
              const dispatch = needsFetch.find(d => d.tracking_id === tid);
              if (!dispatch) continue;

              const buffer = await fetchSingleLabel(tid, courier, apiKey);
              if (buffer) {
                pdfBuffers.push(buffer);
                results.push({ order_id: dispatch.order_id, tracking_id: tid, success: true });
              } else {
                results.push({ order_id: dispatch.order_id, tracking_id: tid, success: false, error: 'Failed to fetch label' });
              }
            }
          }
        } catch (err: any) {
          console.error(`[BULK-PRINT] Batch ${batchIndex + 1} error:`, err);
          batch.forEach(tid => {
            const dispatch = needsFetch.find(d => d.tracking_id === tid);
            if (dispatch) {
              results.push({ order_id: dispatch.order_id, tracking_id: tid, success: false, error: err.message });
            }
          });
        }

        // Rate limit delay between batches
        if (batchIndex < batches.length - 1) {
          await new Promise(r => setTimeout(r, rateDelayMs));
        }
      }
    }

    // 3. Consolidate all PDFs into 3-per-A4 layout
    if (pdfBuffers.length === 0) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'No labels could be retrieved',
          results
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[BULK-PRINT] Consolidating ${pdfBuffers.length} PDFs into ${labels_per_page}-per-page layout`);
    const consolidatedPdf = await consolidateLabels(pdfBuffers, labels_per_page);

    // 4. Upload consolidated PDF to storage
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const storagePath = `bulk-prints/${timestamp}-${courier_code.toLowerCase()}.pdf`;

    const { error: uploadError } = await supabase.storage
      .from('courier-labels')
      .upload(storagePath, consolidatedPdf, {
        contentType: 'application/pdf',
        upsert: true
      });

    if (uploadError) {
      console.error('[BULK-PRINT] Failed to upload consolidated PDF:', uploadError);
      // Return base64 as fallback
      const base64 = btoa(
        new Uint8Array(consolidatedPdf).reduce((data, byte) => data + String.fromCharCode(byte), '')
      );
      return new Response(
        JSON.stringify({
          success: true,
          pdf_data: base64,
          results,
          total_labels: results.filter(r => r.success).length,
          total_pages: Math.ceil(results.filter(r => r.success).length / labels_per_page)
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get public URL for download
    const { data: publicUrl } = supabase.storage
      .from('courier-labels')
      .getPublicUrl(storagePath);

    console.log(`[BULK-PRINT] Complete: ${results.filter(r => r.success).length} labels consolidated`);

    // 5. Create AWB record for tracking
    const successfulOrders = results.filter(r => r.success).map(r => r.order_id);
    const successfulTracking = results.filter(r => r.success).map(r => r.tracking_id);

    await supabase.from('courier_awbs').insert({
      courier_code: courier_code.toUpperCase(),
      order_ids: successfulOrders,
      tracking_ids: successfulTracking,
      generated_by: user.id,
      status: 'completed',
      total_orders: successfulOrders.length,
      batch_count: Math.ceil(pdfBuffers.length / 10),
      storage_path: storagePath,
      labels_per_page: labels_per_page,
      expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() // 7 days
    });

    return new Response(
      JSON.stringify({
        success: true,
        download_url: publicUrl.publicUrl,
        storage_path: storagePath,
        results,
        total_labels: results.filter(r => r.success).length,
        failed_labels: results.filter(r => !r.success).length,
        total_pages: Math.ceil(results.filter(r => r.success).length / labels_per_page)
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('[BULK-PRINT] Error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
