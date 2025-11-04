import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.2';
import { getAPISetting } from '../_shared/apiSettings.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SyncStats {
  products: number;
  orders: number;
  customers: number;
  errors: string[];
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

    console.log('Starting comprehensive Shopify sync...');

    const stats: SyncStats = {
      products: 0,
      orders: 0,
      customers: 0,
      errors: [],
    };

    // Log sync start
    const { data: syncLog } = await supabase
      .from('shopify_sync_log')
      .insert({
        sync_type: 'full',
        sync_direction: 'from_shopify',
        status: 'in_progress',
        triggered_by: authData.user.id,
      })
      .select('id')
      .single();

    try {
      // 1. Sync Products
      console.log('=== Starting Product Sync ===');
      try {
        const { data: prodData, error: prodErr } = await supabase.functions.invoke('sync-shopify-products', {
          headers: { 'Authorization': authHeader },
          body: {},
        });
        if (prodErr) {
          console.error('Product sync error response:', prodErr);
          throw prodErr;
        }
        stats.products = (prodData as any)?.synced || 0;
        console.log(`✓ Products sync completed: ${stats.products} products synced`);
      } catch (error) {
        console.error('Product sync error:', error);
        stats.errors.push(`Product sync error: ${error.message}`);
      }

      // 2. Sync Customers
      console.log('=== Starting Customer Sync ===');
      try {
        const { data: custData, error: custErr } = await supabase.functions.invoke('sync-shopify-customers', {
          headers: { 'Authorization': authHeader },
          body: {},
        });
        if (custErr) {
          console.error('Customer sync error response:', custErr);
          throw custErr;
        }
        const customersSynced = (custData as any)?.synced || 0;
        stats.customers += customersSynced;
        console.log(`✓ Customers sync completed: ${customersSynced} customers synced`);
      } catch (error) {
        console.error('Customer sync error:', error);
        stats.errors.push(`Customer sync error: ${error.message}`);
      }

      // 3. Sync Orders from Shopify (paginated)
      console.log('=== Starting Order Sync ===');
      try {
        const storeUrl = await getAPISetting('SHOPIFY_STORE_URL', supabase);
        const apiToken = await getAPISetting('SHOPIFY_ADMIN_API_TOKEN', supabase);
        const apiVersion = (await getAPISetting('SHOPIFY_API_VERSION', supabase)) || '2024-01';

        if (!storeUrl || !apiToken) {
          throw new Error('Shopify credentials not configured');
        }

        const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
        const parseNext = (linkHeader: string | null): string | null => {
          if (!linkHeader) return null;
          const parts = linkHeader.split(',');
          for (const part of parts) {
            if (part.includes('rel="next"')) {
              const m = part.match(/page_info=([^&>]+)/);
              if (m && m[1]) return m[1];
            }
          }
          return null;
        };

        let url = `${storeUrl}/admin/api/${apiVersion}/orders.json?status=any&limit=250`;
        let pageCount = 0;

        while (url) {
          pageCount++;
          console.log(`Fetching orders page ${pageCount}...`);
          const res = await fetch(url, { headers: { 'X-Shopify-Access-Token': apiToken! } });
          if (!res.ok) {
            const text = await res.text();
            throw new Error(`Orders fetch failed (${res.status}): ${text}`);
          }
          const payload = await res.json();
          const orders = payload.orders || [];
          console.log(`Processing ${orders.length} orders from page ${pageCount}`);

          for (const order of orders) {
            try {
              const { data: existing } = await supabase
                .from('orders')
                .select('id')
                .eq('shopify_order_id', order.id)
                .maybeSingle();

              let customerId = null as string | null;
              if (order.customer) {
                const normalizedPhone = order.customer.phone?.replace(/\D/g, '');
                const { data: existingCustomer } = await supabase
                  .from('customers')
                  .select('id')
                  .eq('shopify_customer_id', order.customer.id)
                  .maybeSingle();

                if (existingCustomer) {
                  customerId = existingCustomer.id;
                } else {
                  const { data: newCustomer } = await supabase
                    .from('customers')
                    .insert({
                      name: `${order.customer.first_name || ''} ${order.customer.last_name || ''}`.trim() || 'Unknown',
                      email: order.customer.email,
                      phone: normalizedPhone,
                      phone_last_5_chr: normalizedPhone?.slice(-5),
                      shopify_customer_id: order.customer.id,
                      created_at: new Date().toISOString(),
                    })
                    .select('id')
                    .maybeSingle();
                  customerId = newCustomer?.id || null;
                  if (newCustomer?.id) stats.customers++;
                }
              }

              const orderData: Record<string, any> = {
                order_number: `SHOP-${order.order_number}`,
                shopify_order_number: String(order.order_number),
                shopify_order_id: order.id,
                customer_id: customerId,
                customer_name: order.customer ? `${order.customer.first_name || ''} ${order.customer.last_name || ''}`.trim() || 'Unknown' : 'Unknown',
                customer_email: order.customer?.email || order.email || null,
                customer_phone: order.customer?.phone || order.phone || null,
                customer_address: order.shipping_address?.address1 || 'N/A',
                city: order.shipping_address?.city || 'N/A',
                total_amount: parseFloat(order.total_price),
                tags: order.tags ? order.tags.split(',').map((t: string) => t.trim()) : [],
                status: order.fulfillment_status === 'fulfilled' ? 'delivered' : 'pending',
                synced_to_shopify: true,
                last_shopify_sync: new Date().toISOString(),
              };

              if (!existing) {
                await supabase.from('orders').insert(orderData);
                stats.orders++;
              } else {
                await supabase.from('orders').update(orderData).eq('id', existing.id);
              }
            } catch (err) {
              const msg = (err as any)?.message || String(err);
              stats.errors.push(`Order ${order?.order_number} sync failed: ${msg}`);
            }
          }

          const link = res.headers.get('Link');
          const nextPageInfo = parseNext(link);
          if (nextPageInfo) {
            url = `${storeUrl}/admin/api/${apiVersion}/orders.json?status=any&limit=250&page_info=${nextPageInfo}`;
            await sleep(300);
          } else {
            url = null as unknown as string;
          }
        }

        console.log(`✓ Orders sync completed: ${stats.orders} orders synced across ${pageCount} pages`);
      } catch (error) {
        console.error('Order sync error:', error);
        stats.errors.push(`Order sync error: ${error.message}`);
      }

      // Update sync log
      if (syncLog) {
        await supabase
          .from('shopify_sync_log')
          .update({
            status: stats.errors.length === 0 ? 'success' : 'partial',
            records_processed: stats.products + stats.orders + stats.customers,
            records_failed: stats.errors.length,
            error_details: stats.errors.length > 0 ? { errors: stats.errors } : null,
            completed_at: new Date().toISOString(),
          })
          .eq('id', syncLog.id);
      }

      console.log('Sync completed:', stats);

      return new Response(
        JSON.stringify({
          success: true,
          stats,
          message: `Synced ${stats.products} products, ${stats.orders} orders, ${stats.customers} customers`,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    } catch (error) {
      // Update sync log with error
      if (syncLog) {
        await supabase
          .from('shopify_sync_log')
          .update({
            status: 'failed',
            error_details: { message: error.message, stack: error.stack },
            completed_at: new Date().toISOString(),
          })
          .eq('id', syncLog.id);
      }
      throw error;
    }
  } catch (error) {
    console.error('Error in comprehensive Shopify sync:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
