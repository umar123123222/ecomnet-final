import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.2';
import { getAPISetting } from '../_shared/apiSettings.ts';
import { calculateOrderTotal, filterActiveLineItems } from '../_shared/orderTotalCalculator.ts';
import { syncOrderItems } from '../_shared/orderItemsSync.ts';
import { getEcomnetStatusTag } from '../_shared/ecomnetStatusTags.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function generateShopifyTags(order: any, existingTags: string[] = []): string[] {
  const nonShopifyTags = existingTags.filter(tag => !tag.startsWith('Shopify - '));
  const shopifyTags: string[] = [];
  
  if (order.fulfillment_status === 'fulfilled') {
    shopifyTags.push('Shopify - Fulfilled');
  } else if (order.fulfillment_status === 'partial') {
    shopifyTags.push('Shopify - Partially Fulfilled');
  }
  
  if (order.financial_status === 'paid') {
    shopifyTags.push('Shopify - Paid');
  } else if (order.financial_status === 'pending') {
    shopifyTags.push('Shopify - Pending Payment');
  } else if (order.financial_status === 'refunded') {
    shopifyTags.push('Shopify - Refunded');
  } else if (order.financial_status === 'voided') {
    shopifyTags.push('Shopify - Voided');
  }
  
  if (order.cancelled_at) {
    shopifyTags.push('Shopify - Cancelled');
  }
  
  return [...nonShopifyTags, ...shopifyTags];
}

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
  total_shipping_price_set?: {
    shop_money: { amount: string; currency_code: string; };
  };
  shipping_lines?: Array<{ price: string; title: string; }>;
  cancelled_at?: string;
}

/**
 * 3-step customer deduplication matching shopify-webhook-orders quality
 * Priority: shopify_customer_id → normalized phone → email
 */
async function findOrCreateCustomer(order: ShopifyOrder, supabaseClient: any): Promise<string | null> {
  if (!order.customer) return null;

  const normalizedPhone = (order.customer.phone || order.shipping_address?.phone || '').replace(/\D/g, '');
  const customerName = `${order.customer.first_name || ''} ${order.customer.last_name || ''}`.trim() || 'Unknown Customer';
  const customerEmail = order.customer.email || '';

  // Step 1: Find by shopify_customer_id
  if (order.customer.id) {
    const { data: existingByShopify } = await supabaseClient
      .from('customers')
      .select('id')
      .eq('shopify_customer_id', order.customer.id)
      .maybeSingle();

    if (existingByShopify) {
      console.log(`Found customer by Shopify ID: ${existingByShopify.id}`);
      await supabaseClient
        .from('customers')
        .update({
          name: customerName,
          email: customerEmail,
          phone: normalizedPhone,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existingByShopify.id);
      return existingByShopify.id;
    }
  }

  // Step 2: Find by normalized phone
  if (normalizedPhone) {
    const { data: phoneMatches } = await supabaseClient
      .from('customers')
      .select('id, phone')
      .filter('phone', 'neq', null)
      .filter('phone', 'neq', '')
      .limit(100);

    const existingByPhone = phoneMatches?.find((c: any) => {
      const custNorm = c.phone?.replace(/\D/g, '');
      return custNorm === normalizedPhone;
    });

    if (existingByPhone) {
      console.log(`Found customer by phone: ${existingByPhone.id}, linking Shopify ID ${order.customer.id}`);
      await supabaseClient
        .from('customers')
        .update({
          shopify_customer_id: order.customer.id,
          name: customerName,
          email: customerEmail,
          phone: normalizedPhone,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existingByPhone.id);
      return existingByPhone.id;
    }
  }

  // Step 3: Find by email
  if (customerEmail) {
    const { data: existingByEmail } = await supabaseClient
      .from('customers')
      .select('id')
      .ilike('email', customerEmail)
      .maybeSingle();

    if (existingByEmail) {
      console.log(`Found customer by email: ${existingByEmail.id}, linking Shopify ID ${order.customer.id}`);
      await supabaseClient
        .from('customers')
        .update({
          shopify_customer_id: order.customer.id,
          name: customerName,
          phone: normalizedPhone,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existingByEmail.id);
      return existingByEmail.id;
    }
  }

  // Step 4: Create new customer
  console.log(`Creating new customer for Shopify ID ${order.customer.id}`);
  const { data: newCustomer } = await supabaseClient
    .from('customers')
    .insert({
      name: customerName,
      email: customerEmail,
      phone: normalizedPhone,
      phone_last_5_chr: normalizedPhone?.slice(-5) || '',
      shopify_customer_id: order.customer.id,
      total_orders: 0,
      return_count: 0,
    })
    .select('id')
    .single();

  return newCustomer?.id || null;
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

    // Function to fetch a Shopify order by order number using search API
    const fetchOrderByName = async (orderName: string): Promise<ShopifyOrder> => {
      // Strip # prefix if present
      const cleanName = orderName.replace(/^#/, '');
      const searchUrl = `https://${storeUrl}/admin/api/${apiVersion}/orders.json?name=${encodeURIComponent(cleanName)}&status=any&limit=1`;
      console.log(`Searching Shopify for order by name: ${cleanName}`);

      const response = await fetch(searchUrl, {
        headers: {
          'X-Shopify-Access-Token': accessToken,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Shopify search API error: ${response.status} - ${errorText}`);
      }

      const { orders } = await response.json() as { orders: ShopifyOrder[] };
      if (!orders || orders.length === 0) {
        throw new Error(`Order "${orderName}" not found in Shopify`);
      }
      return orders[0];
    };

    // Function to fetch a Shopify order by numeric ID
    const fetchOrderById = async (shopifyId: string): Promise<ShopifyOrder> => {
      const shopifyUrl = `https://${storeUrl}/admin/api/${apiVersion}/orders/${shopifyId}.json`;
      console.log(`Fetching order from Shopify by ID: ${shopifyId}`);

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
        throw new Error(`Order with Shopify ID ${shopifyId} not found`);
      }
      return order;
    };

    // Function to fetch and sync a single order
    const syncOrder = async (identifier: string, isShopifyId: boolean) => {
      try {
        // Use the correct API endpoint based on identifier type
        const order = isShopifyId
          ? await fetchOrderById(identifier)
          : await fetchOrderByName(identifier);

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

        // BUG-1 FIX: Use 3-step customer deduplication (matching webhook quality)
        const customerId = await findOrCreateCustomer(order, supabaseClient);

        // Generate Shopify tags based on order state
        const baseShopifyTags = order.tags ? order.tags.split(',').map((t: string) => t.trim()) : [];
        const shopifyStateTags = generateShopifyTags(order, baseShopifyTags);
        
        // Add Ecomnet status tag
        const initialStatus = order.cancelled_at ? 'cancelled' : 'pending';
        const ecomnetTag = getEcomnetStatusTag(initialStatus);
        const allTags = [...shopifyStateTags, ecomnetTag];

        // Filter active line items
        const activeLineItems = filterActiveLineItems(order.line_items);

        // BUG-2 FIX: Extract shipping charges (matching webhook quality)
        const shippingCharges = parseFloat(
          order.total_shipping_price_set?.shop_money?.amount || 
          order.shipping_lines?.reduce((sum, line) => sum + parseFloat(line.price || '0'), 0).toString() || 
          '0'
        );
        console.log(`Order ${order.name} shipping charges: ${shippingCharges}`);

        const normalizedPhone = (order.customer?.phone || order.shipping_address?.phone || '').replace(/\D/g, '');

        // Create order
        const { data: newOrder, error: orderError } = await supabaseClient
          .from('orders')
          .insert({
            order_number: order.name,
            shopify_order_id: order.id,
            customer_id: customerId,
            customer_name: order.customer ? 
              `${order.customer.first_name || ''} ${order.customer.last_name || ''}`.trim() 
              : 'Unknown Customer',
            customer_phone: normalizedPhone,
            customer_phone_last_5_chr: normalizedPhone?.slice(-5) || '',
            customer_email: order.customer?.email || '',
            customer_address: order.shipping_address ?
              `${order.shipping_address.address1 || ''} ${order.shipping_address.address2 || ''}`.trim() 
              : '',
            city: order.shipping_address?.city || '',
            outlet_id: outlet.id,
            total_amount: calculateOrderTotal(order.line_items, order.total_price, shippingCharges),
            shipping_charges: shippingCharges,
            total_items: activeLineItems.length.toString(),
            status: initialStatus,
            tags: allTags,
            notes: order.note || '',
            confirmation_required: false,
            synced_to_shopify: true,
            last_shopify_sync: new Date().toISOString(),
            items: activeLineItems.map(item => ({
              id: item.id,
              name: item.name,
              quantity: item.quantity,
              price: item.price,
              product_id: item.product_id,
              variant_id: item.variant_id,
            })),
          })
          .select('id')
          .single();

        if (orderError) {
          throw orderError;
        }

        // BUG-3 FIX: Create order_items using shared syncOrderItems function
        if (newOrder && order.line_items && order.line_items.length > 0) {
          const itemsSyncResult = await syncOrderItems(
            supabaseClient,
            newOrder.id,
            order.line_items,
            false // isUpdate = false, this is a new order
          );
          console.log(`✓ Items synced for order ${order.name}: ${itemsSyncResult.itemsCreated} created, ${itemsSyncResult.matchedProducts} matched`);
        }

        console.log(`Successfully synced order ${order.name}`);
        results.synced.push(order.name);

        // Log activity
        if (newOrder) {
          await supabaseClient
            .from('activity_logs')
            .insert({
              action: 'order_created',
              entity_type: 'order',
              entity_id: newOrder.id,
              details: {
                shopify_order_id: order.id,
                order_number: order.name,
                source: 'manual_resync',
              },
              user_id: user.id,
            });
        }

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
