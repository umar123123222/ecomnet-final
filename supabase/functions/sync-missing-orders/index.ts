import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.2';
import { getAPISetting } from '../_shared/apiSettings.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ShopifyOrder {
  id: number;
  order_number: number;
  name: string;
  created_at: string;
  updated_at: string;
  total_price: string;
  financial_status: string;
  fulfillment_status: string | null;
  customer: any;
  shipping_address: any;
  line_items: any[];
  tags: string;
  note: string | null;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Authenticate user
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Missing authorization header');
    }

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (userError || !user) {
      throw new Error('Unauthorized');
    }

    const { orderNumbers, shopifyOrderIds } = await req.json();

    if ((!orderNumbers || orderNumbers.length === 0) && (!shopifyOrderIds || shopifyOrderIds.length === 0)) {
      throw new Error('Must provide either orderNumbers or shopifyOrderIds array');
    }

    console.log('Syncing missing orders:', { orderNumbers, shopifyOrderIds });

    // Get Shopify credentials
    const storeUrl = await getAPISetting('SHOPIFY_STORE_URL', supabaseClient);
    const accessToken = await getAPISetting('SHOPIFY_ADMIN_API_TOKEN', supabaseClient);
    const apiVersion = await getAPISetting('SHOPIFY_API_VERSION', supabaseClient) || '2024-01';

    if (!storeUrl || !accessToken) {
      throw new Error('Shopify credentials not configured');
    }

    const results = {
      synced: [] as string[],
      failed: [] as { identifier: string; error: string }[],
      alreadyExists: [] as string[],
    };

    // Function to fetch and sync a single order
    const syncOrder = async (identifier: string, isShopifyId: boolean) => {
      try {
        // Fetch order from Shopify
        const shopifyUrl = `https://${storeUrl}/admin/api/${apiVersion}/orders/${identifier}.json`;
        console.log(`Fetching order from Shopify: ${shopifyUrl}`);

        const response = await fetch(shopifyUrl, {
          headers: {
            'X-Shopify-Access-Token': accessToken,
            'Content-Type': 'application/json',
          },
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Shopify API error: ${response.status} - ${errorText}`);
        }

        const { order } = await response.json() as { order: ShopifyOrder };

        if (!order) {
          throw new Error('Order not found in Shopify');
        }

        // Check if order already exists
        const { data: existingOrder } = await supabaseClient
          .from('orders')
          .select('id, order_number')
          .eq('shopify_order_id', order.id)
          .maybeSingle();

        if (existingOrder) {
          console.log(`Order ${order.name} already exists in database`);
          results.alreadyExists.push(order.name);
          
          // Update missing_orders_log if exists
          await supabaseClient
            .from('missing_orders_log')
            .update({ 
              sync_status: 'synced', 
              synced_at: new Date().toISOString(),
              shopify_order_id: order.id 
            })
            .eq('order_number', order.name);
          
          return;
        }

        // Get default outlet
        const { data: outlet } = await supabaseClient
          .from('outlets')
          .select('id')
          .eq('is_default', true)
          .single();

        if (!outlet) {
          throw new Error('No default outlet found');
        }

        // Create customer if needed
        let customerId = null;
        if (order.customer) {
          const customerPhone = order.customer.phone || order.shipping_address?.phone || '';
          
          const { data: existingCustomer } = await supabaseClient
            .from('customers')
            .select('id')
            .eq('phone', customerPhone)
            .maybeSingle();

          if (existingCustomer) {
            customerId = existingCustomer.id;
          } else {
            const { data: newCustomer } = await supabaseClient
              .from('customers')
              .insert({
                name: order.customer.first_name && order.customer.last_name
                  ? `${order.customer.first_name} ${order.customer.last_name}`
                  : order.customer.email || 'Unknown Customer',
                phone: customerPhone,
                email: order.customer.email,
                address: order.shipping_address ? 
                  `${order.shipping_address.address1 || ''} ${order.shipping_address.address2 || ''}`.trim() 
                  : '',
                city: order.shipping_address?.city || '',
              })
              .select('id')
              .single();
            
            customerId = newCustomer?.id;
          }
        }

        // Map Shopify status to internal status
        let internalStatus = 'pending';
        if (order.financial_status === 'refunded' || order.financial_status === 'voided') {
          internalStatus = 'cancelled';
        } else if (order.fulfillment_status === 'fulfilled') {
          internalStatus = 'delivered';
        } else if (order.fulfillment_status === 'partial') {
          internalStatus = 'dispatched';
        }

        // Create order
        const { error: orderError } = await supabaseClient
          .from('orders')
          .insert({
            order_number: order.name,
            shopify_order_id: order.id,
            customer_id: customerId,
            customer_name: order.customer ? 
              `${order.customer.first_name || ''} ${order.customer.last_name || ''}`.trim() 
              : 'Unknown Customer',
            customer_phone: order.customer?.phone || order.shipping_address?.phone || '',
            customer_email: order.customer?.email || '',
            customer_address: order.shipping_address ? 
              `${order.shipping_address.address1 || ''} ${order.shipping_address.address2 || ''}`.trim() 
              : '',
            city: order.shipping_address?.city || '',
            outlet_id: outlet.id,
            total_amount: parseFloat(order.total_price),
            status: internalStatus,
            tags: order.tags ? order.tags.split(',').map((t: string) => t.trim()) : [],
            notes: order.note || '',
            confirmation_required: false, // Shopify orders don't need confirmation
          });

        if (orderError) {
          throw orderError;
        }

        console.log(`Successfully synced order ${order.name}`);
        results.synced.push(order.name);

        // Update missing_orders_log
        await supabaseClient
          .from('missing_orders_log')
          .update({ 
            sync_status: 'synced', 
            synced_at: new Date().toISOString(),
            shopify_order_id: order.id 
          })
          .eq('order_number', order.name);

      } catch (error: any) {
        console.error(`Failed to sync order ${identifier}:`, error);
        results.failed.push({ identifier, error: error.message });

        // Update missing_orders_log with error
        await supabaseClient
          .from('missing_orders_log')
          .update({ 
            sync_status: 'failed', 
            error_message: error.message 
          })
          .or(`order_number.eq.${identifier},shopify_order_id.eq.${identifier}`);
      }
    };

    // Sync orders in parallel
    const syncPromises = [];
    
    if (orderNumbers && orderNumbers.length > 0) {
      for (const orderNumber of orderNumbers) {
        syncPromises.push(syncOrder(orderNumber, false));
      }
    }
    
    if (shopifyOrderIds && shopifyOrderIds.length > 0) {
      for (const shopifyId of shopifyOrderIds) {
        syncPromises.push(syncOrder(shopifyId, true));
      }
    }

    await Promise.all(syncPromises);

    console.log('Sync results:', results);

    return new Response(
      JSON.stringify({
        success: true,
        results,
        message: `Synced ${results.synced.length} orders, ${results.alreadyExists.length} already existed, ${results.failed.length} failed`,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error: any) {
    console.error('Sync missing orders error:', error);
    
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
