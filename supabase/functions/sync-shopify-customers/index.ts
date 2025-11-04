import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.2';
import { getAPISetting } from '../_shared/apiSettings.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CustomerSyncStats {
  processed: number;
  created: number;
  updated: number;
  errors: string[];
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseNextPageInfo(linkHeader: string | null): string | null {
  if (!linkHeader) return null;
  // Link: <...page_info=xyz>; rel="previous", <...page_info=abc>; rel="next"
  const parts = linkHeader.split(',');
  for (const part of parts) {
    if (part.includes('rel="next"')) {
      const match = part.match(/page_info=([^&>]+)/);
      if (match && match[1]) return match[1];
    }
  }
  return null;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: authData } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));
    if (!authData.user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('Starting Shopify customers sync...');

    const storeUrl = await getAPISetting('SHOPIFY_STORE_URL', supabase);
    const apiToken = await getAPISetting('SHOPIFY_ADMIN_API_TOKEN', supabase);
    const apiVersion = (await getAPISetting('SHOPIFY_API_VERSION', supabase)) || '2024-01';

    if (!storeUrl || !apiToken) {
      throw new Error('Shopify credentials not configured');
    }

    const stats: CustomerSyncStats = {
      processed: 0,
      created: 0,
      updated: 0,
      errors: [],
    };

    // Create sync log entry
    const { data: syncLog } = await supabase
      .from('shopify_sync_log')
      .insert({
        sync_type: 'customers',
        sync_direction: 'from_shopify',
        status: 'in_progress',
        triggered_by: authData.user.id,
      })
      .select('id')
      .single();

    console.log('Sync log created:', syncLog?.id);

    let url = `${storeUrl}/admin/api/${apiVersion}/customers.json?limit=250&fields=id,first_name,last_name,email,phone,default_address,orders_count,total_spent`;

    try {
      while (url) {
      try {
        const res = await fetch(url, {
          headers: { 'X-Shopify-Access-Token': apiToken },
        });

        if (!res.ok) {
          const text = await res.text();
          throw new Error(`Shopify customers fetch failed (${res.status}): ${text}`);
        }

        const data = await res.json();
        const customers = data.customers || [];

        for (const c of customers) {
          try {
            const fullName = `${c.first_name || ''} ${c.last_name || ''}`.trim() || 'Unknown';
            const normalizedPhone = c.phone?.replace(/\D/g, '') || null;
            const phoneLast5 = normalizedPhone ? normalizedPhone.slice(-5) : null;
            const address1 = c.default_address?.address1 || null;
            const city = c.default_address?.city || null;

            // Check existing by Shopify ID
            const { data: existing } = await supabase
              .from('customers')
              .select('id')
              .eq('shopify_customer_id', c.id)
              .maybeSingle();

            const payload: Record<string, any> = {
              name: fullName,
              email: c.email || null,
              phone: normalizedPhone,
              phone_last_5_chr: phoneLast5,
              address: address1,
              city: city,
              shopify_customer_id: c.id,
              total_orders: typeof c.orders_count === 'number' ? c.orders_count : undefined,
              updated_at: new Date().toISOString(),
            };

            if (!existing) {
              await supabase.from('customers').insert({
                ...payload,
                created_at: new Date().toISOString(),
              });
              stats.created++;
            } else {
              await supabase.from('customers').update(payload).eq('id', existing.id);
              stats.updated++;
            }

            stats.processed++;
          } catch (err) {
            const msg = (err as any)?.message || String(err);
            stats.errors.push(`Customer ${c?.id} sync error: ${msg}`);
          }
        }

        const link = res.headers.get('Link');
        const nextPageInfo = parseNextPageInfo(link);
        if (nextPageInfo) {
          url = `${storeUrl}/admin/api/${apiVersion}/customers.json?limit=250&page_info=${nextPageInfo}&fields=id,first_name,last_name,email,phone,default_address,orders_count,total_spent`;
          console.log(`Fetching next page... Total processed so far: ${stats.processed}`);
          // be gentle with API rate limits
          await sleep(300);
        } else {
          url = null as unknown as string; // exit loop
        }
      } catch (err) {
        const msg = (err as any)?.message || String(err);
        console.error('Page fetch error:', msg);
        stats.errors.push(`Customers page fetch error: ${msg}`);
        break;
      }
      }

      console.log('Customers sync completed', stats);

      // Update sync log with success
      if (syncLog) {
        await supabase
          .from('shopify_sync_log')
          .update({
            status: stats.errors.length === 0 ? 'success' : 'partial',
            records_processed: stats.created + stats.updated,
            records_failed: stats.errors.length,
            error_details: stats.errors.length > 0 ? { errors: stats.errors } : null,
            completed_at: new Date().toISOString(),
          })
          .eq('id', syncLog.id);
      }

      return new Response(
        JSON.stringify({ success: true, synced: stats.processed, created: stats.created, updated: stats.updated, errors: stats.errors }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    } catch (error) {
      // Update sync log with failure
      if (syncLog) {
        await supabase
          .from('shopify_sync_log')
          .update({
            status: 'failed',
            records_processed: stats.created + stats.updated,
            records_failed: stats.errors.length,
            error_details: { 
              message: (error as any)?.message || String(error),
              errors: stats.errors 
            },
            completed_at: new Date().toISOString(),
          })
          .eq('id', syncLog.id);
      }
      throw error;
    }
  } catch (error) {
    console.error('Error in Shopify customers sync:', error);
    return new Response(JSON.stringify({ error: (error as any)?.message || String(error) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});