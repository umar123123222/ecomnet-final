import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.2';
import type { Database } from '../_shared/database.types.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Helper types and functions
interface CustomerSyncStats {
  processed: number;
  created: number;
  updated: number;
  errors: string[];
}

interface SyncRequestBody {
  runId?: string;
  pageInfo?: string;
  maxPages?: number;
  mode?: 'full' | 'incremental';
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseNextPageInfo(linkHeader: string | null): string | null {
  if (!linkHeader) return null;
  const nextLink = linkHeader.split(',').find(link => link.includes('rel="next"'));
  if (!nextLink) return null;
  const match = nextLink.match(/page_info=([^&>]+)/);
  return match ? match[1] : null;
}

function parseCallLimit(header: string | null): { current: number; max: number } | null {
  if (!header) return null;
  const match = header.match(/(\d+)\/(\d+)/);
  if (!match) return null;
  return { current: parseInt(match[1]), max: parseInt(match[2]) };
}

async function maybeRespectRateLimit(res: Response): Promise<void> {
  const limitHeader = res.headers.get('X-Shopify-Shop-Api-Call-Limit');
  const limit = parseCallLimit(limitHeader);
  
  if (limit && limit.current / limit.max > 0.8) {
    const delay = Math.min(1000, 500 + (limit.current / limit.max) * 500);
    console.log(`[Rate Limit] ${limit.current}/${limit.max}, sleeping ${delay}ms`);
    await sleep(delay);
  } else {
    await sleep(700);
  }
}

async function fetchWithRetries(
  url: string,
  apiToken: string,
  retries = 3,
  attempt = 1
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000);

  try {
    const res = await fetch(url, {
      headers: {
        'X-Shopify-Access-Token': apiToken,
        'Content-Type': 'application/json',
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (res.status === 429 || (res.status >= 500 && res.status < 600)) {
      if (attempt <= retries) {
        const delay = Math.pow(2, attempt) * 1000;
        console.warn(`[Retry ${attempt}/${retries}] Status ${res.status}, waiting ${delay}ms`);
        await sleep(delay);
        return fetchWithRetries(url, apiToken, retries, attempt + 1);
      }
    }

    return res;
  } catch (error: any) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      console.error(`[Timeout] Request exceeded 30s`);
    }
    if (attempt <= retries) {
      const delay = Math.pow(2, attempt) * 1000;
      console.warn(`[Network Error - Retry ${attempt}/${retries}] ${error.message}, waiting ${delay}ms`);
      await sleep(delay);
      return fetchWithRetries(url, apiToken, retries, attempt + 1);
    }
    throw error;
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    const authHeader = req.headers.get('Authorization')!;
    
    // User client for authentication
    const userClient = createClient<Database>(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Admin client for all DB operations (bypasses RLS)
    const admin = createClient<Database>(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { persistSession: false } }
    );

    const body: SyncRequestBody = await req.json().catch(() => ({}));
    const { runId, pageInfo, maxPages = 5, mode = 'full' } = body;

    console.log(`[Sync Start] runId=${runId || 'NEW'}, pageInfo=${pageInfo || 'FIRST'}, maxPages=${maxPages}, mode=${mode}`);

    const { data: settings } = await admin
      .from('api_settings')
      .select('setting_key, setting_value')
      .in('setting_key', ['SHOPIFY_STORE_URL', 'SHOPIFY_ADMIN_API_TOKEN', 'SHOPIFY_API_VERSION']);

    const storeUrl = settings?.find(s => s.setting_key === 'SHOPIFY_STORE_URL')?.setting_value;
    const apiToken = settings?.find(s => s.setting_key === 'SHOPIFY_ADMIN_API_TOKEN')?.setting_value;
    const apiVersion = settings?.find(s => s.setting_key === 'SHOPIFY_API_VERSION')?.setting_value || '2024-01';

    if (!storeUrl || !apiToken) {
      return new Response(JSON.stringify({ error: 'Missing Shopify credentials' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const baseUrl = new URL(storeUrl).origin;

    // Clean up stale in_progress logs FIRST (older than 5 minutes)
    await admin
      .from('shopify_sync_log')
      .update({ 
        status: 'failed', 
        completed_at: new Date().toISOString(),
        error_details: { error: 'Sync interrupted - auto-cancelled due to timeout' }
      })
      .eq('sync_type', 'customers')
      .eq('status', 'in_progress')
      .lt('started_at', new Date(Date.now() - 5 * 60 * 1000).toISOString());

    // Check for existing in-progress sync (after cleanup)
    if (!runId) {
      const { data: existingSync } = await admin
        .from('shopify_sync_log')
        .select('id, started_at')
        .eq('sync_type', 'customers')
        .eq('status', 'in_progress')
        .gte('started_at', new Date(Date.now() - 5 * 60 * 1000).toISOString())
        .maybeSingle();

      if (existingSync) {
        return new Response(JSON.stringify({ 
          error: 'Sync already in progress', 
          runId: existingSync.id,
          message: 'Resume the existing sync or wait for it to complete'
        }), {
          status: 409,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    let currentRunId = runId;
    let totalCount: number | null = null;

    // Create or get existing sync log
    if (!currentRunId) {
      // Get total count for progress tracking
      const countUrl = `${baseUrl}/admin/api/${apiVersion}/customers/count.json`;
      const countRes = await fetchWithRetries(countUrl, apiToken);
      if (countRes.ok) {
        const countData = await countRes.json();
        totalCount = countData.count || null;
      }

      const { data: newLog, error: logError } = await admin
        .from('shopify_sync_log')
        .insert({
          sync_type: 'customers',
          sync_direction: 'from_shopify',
          status: 'in_progress',
          triggered_by: user.id,
          started_at: new Date().toISOString(),
          error_details: totalCount ? { total_count: totalCount } : {}
        })
        .select()
        .single();

      if (logError || !newLog) {
        throw new Error(`Failed to create sync log: ${logError?.message}`);
      }

      currentRunId = newLog.id;
      console.log(`[New Sync] Created runId=${currentRunId}, totalCount=${totalCount}`);
    } else {
      const { data: existingLog } = await admin
        .from('shopify_sync_log')
        .select('error_details')
        .eq('id', currentRunId)
        .maybeSingle();

      totalCount = existingLog?.error_details?.total_count || null;
    }

    let savedSoFar = 0;
    let fetchedSoFar = 0;
    const stats: CustomerSyncStats = { processed: 0, created: 0, updated: 0, errors: [] };
    let currentPageInfo: string | null = pageInfo || null;
    let pagesProcessed = 0;
    const timeLimit = 25000; // 25 seconds soft limit

    while (pagesProcessed < maxPages) {
      if (Date.now() - startTime > timeLimit) {
        console.log(`[Time Limit] Reached ${timeLimit}ms, saving progress and returning`);
        break;
      }

      const url = currentPageInfo
        ? `${baseUrl}/admin/api/${apiVersion}/customers.json?limit=250&page_info=${currentPageInfo}`
        : `${baseUrl}/admin/api/${apiVersion}/customers.json?limit=250`;

      console.log(`[Page ${pagesProcessed + 1}/${maxPages}] Fetching customers...`);
      
      const res = await fetchWithRetries(url, apiToken);
      
      if (!res.ok) {
        const errorText = await res.text();
        console.error(`[API Error] Status ${res.status}: ${errorText}`);
        throw new Error(`Shopify API error: ${res.status} ${errorText}`);
      }

      const data = await res.json();
      const customers = data.customers || [];
      fetchedSoFar += customers.length;
      console.log(`[Page ${pagesProcessed + 1}] Fetched ${customers.length} customers (total: ${fetchedSoFar})`);

      if (customers.length === 0) {
        console.log('[No More Data] Ending sync');
        break;
      }

      // Batch upsert using the unique index and admin client
      const customerPayloads = customers.map((c: any) => ({
        shopify_customer_id: Number(c.id),
        name: `${c.first_name || ''} ${c.last_name || ''}`.trim() || c.email || 'Unknown',
        email: c.email || null,
        phone: c.phone || c.default_address?.phone || null,
        address: c.default_address ? 
          `${c.default_address.address1 || ''} ${c.default_address.address2 || ''}`.trim() : null,
        city: c.default_address?.city || null,
        total_orders: c.orders_count || 0,
        updated_at: new Date().toISOString(),
      })).filter(p => p.shopify_customer_id);

      console.log(`[Upsert] Attempting to save ${customerPayloads.length} customers...`);

      try {
        const { data: upserted, error: upsertError } = await admin
          .from('customers')
          .upsert(customerPayloads, { 
            onConflict: 'shopify_customer_id',
            count: 'exact'
          })
          .select('id');

        if (upsertError) {
          console.error(`[Upsert Error] ${upsertError.message}`);
          stats.errors.push(`Batch upsert error: ${upsertError.message}`);
        } else {
          const savedCount = upserted?.length || 0;
          savedSoFar += savedCount;
          stats.processed = savedSoFar;
          stats.created += savedCount;
          console.log(`[Batch Success] Saved ${savedCount} customers (total saved: ${savedSoFar})`);
        }
      } catch (error: any) {
        console.error(`[Batch Exception] ${error.message}`);
        stats.errors.push(`Batch exception: ${error.message}`);
      }

      // Update sync log with progress using admin client
      await admin
        .from('shopify_sync_log')
        .update({
          records_processed: savedSoFar,
          records_failed: stats.errors.length,
          error_details: {
            total_count: totalCount,
            fetched: fetchedSoFar,
            next_page_info: parseNextPageInfo(res.headers.get('Link')),
            errors: stats.errors.slice(-5) // Keep last 5 errors
          }
        })
        .eq('id', currentRunId);

      currentPageInfo = parseNextPageInfo(res.headers.get('Link'));
      pagesProcessed++;

      if (!currentPageInfo) {
        console.log('[Pagination End] No more pages');
        break;
      }

      await maybeRespectRateLimit(res);
    }

    const hasMore = !!currentPageInfo;
    const finalStatus = hasMore ? 'in_progress' : (stats.errors.length > 0 ? 'partial' : 'success');

    // Finalize log if complete
    if (!hasMore) {
      await admin
        .from('shopify_sync_log')
        .update({
          status: finalStatus,
          records_processed: savedSoFar,
          records_failed: stats.errors.length,
          completed_at: new Date().toISOString(),
          error_details: stats.errors.length > 0 ? { 
            total_count: totalCount,
            fetched: fetchedSoFar,
            errors: stats.errors 
          } : { total_count: totalCount, fetched: fetchedSoFar }
        })
        .eq('id', currentRunId);

      console.log(`[Sync Complete] Status=${finalStatus}, saved=${savedSoFar}, fetched=${fetchedSoFar}`);
    } else {
      console.log(`[Sync Partial] Processed ${pagesProcessed} pages, hasMore=true`);
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        runId: currentRunId,
        processed: savedSoFar,
        fetched: fetchedSoFar,
        created: stats.created,
        updated: stats.updated,
        errors: stats.errors.length,
        nextPageInfo: currentPageInfo,
        hasMore,
        totalCount,
        message: hasMore 
          ? `Saved ${savedSoFar} / Fetched ${fetchedSoFar} customers. Resume to continue.`
          : `Sync complete: Saved ${savedSoFar} / Fetched ${fetchedSoFar} customers`
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('[Sync Error]', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
