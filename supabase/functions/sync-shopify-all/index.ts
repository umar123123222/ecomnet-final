import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.2';

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
        sync_type: 'full_sync',
        sync_direction: 'bidirectional',
        status: 'in_progress',
        triggered_by: authData.user.id,
      })
      .select('id')
      .single();

    try {
      // 1. Sync Products
      console.log('Syncing products...');
      try {
        const productsResponse = await fetch(`${supabaseUrl}/functions/v1/sync-shopify-products`, {
          method: 'POST',
          headers: {
            'Authorization': authHeader,
            'Content-Type': 'application/json',
          },
        });

        if (productsResponse.ok) {
          const result = await productsResponse.json();
          stats.products = result.synced || 0;
          console.log(`Synced ${stats.products} products`);
        } else {
          stats.errors.push('Failed to sync products');
        }
      } catch (error) {
        stats.errors.push(`Product sync error: ${error.message}`);
      }

      // 2. Sync Orders from Shopify
      console.log('Syncing orders...');
      try {
        const storeUrl = Deno.env.get('SHOPIFY_STORE_URL');
        const apiToken = Deno.env.get('SHOPIFY_ADMIN_API_TOKEN');
        const apiVersion = Deno.env.get('SHOPIFY_API_VERSION') || '2024-01';

        const ordersResponse = await fetch(
          `${storeUrl}/admin/api/${apiVersion}/orders.json?status=any&limit=250`,
          {
            headers: {
              'X-Shopify-Access-Token': apiToken!,
            },
          }
        );

        if (ordersResponse.ok) {
          const ordersData = await ordersResponse.json();
          
          for (const order of ordersData.orders) {
            try {
              // Check if order exists
              const { data: existing } = await supabase
                .from('orders')
                .select('id')
                .eq('shopify_order_id', order.id)
                .single();

              let customerId = null;
              if (order.customer) {
                // Handle customer
                const normalizedPhone = order.customer.phone?.replace(/\D/g, '');
                
                const { data: existingCustomer } = await supabase
                  .from('customers')
                  .select('id')
                  .eq('shopify_customer_id', order.customer.id)
                  .single();

                if (existingCustomer) {
                  customerId = existingCustomer.id;
                } else {
                  const { data: newCustomer } = await supabase
                    .from('customers')
                    .insert({
                      name: `${order.customer.first_name} ${order.customer.last_name}`,
                      email: order.customer.email,
                      phone: normalizedPhone,
                      phone_last_5_chr: normalizedPhone?.slice(-5),
                      shopify_customer_id: order.customer.id,
                    })
                    .select('id')
                    .single();
                  
                  customerId = newCustomer?.id;
                  if (newCustomer) stats.customers++;
                }
              }

              const orderData = {
                order_number: `SHOP-${order.order_number}`,
                shopify_order_number: order.order_number.toString(),
                shopify_order_id: order.id,
                customer_id: customerId,
                customer_name: order.customer ? `${order.customer.first_name} ${order.customer.last_name}` : 'Unknown',
                customer_email: order.customer?.email || order.email,
                customer_phone: order.customer?.phone || order.phone,
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
            } catch (error) {
              stats.errors.push(`Order ${order.order_number} sync failed: ${error.message}`);
            }
          }

          console.log(`Synced ${stats.orders} orders`);
        } else {
          stats.errors.push('Failed to fetch orders from Shopify');
        }
      } catch (error) {
        stats.errors.push(`Order sync error: ${error.message}`);
      }

      // Update sync log
      if (syncLog) {
        await supabase
          .from('shopify_sync_log')
          .update({
            status: stats.errors.length === 0 ? 'completed' : 'completed_with_errors',
            records_processed: stats.products + stats.orders + stats.customers,
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
