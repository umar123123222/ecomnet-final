import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.2';
import { crypto } from 'https://deno.land/std@0.177.0/crypto/mod.ts';
import { getEcomnetStatusTag } from '../_shared/ecomnetStatusTags.ts';
import { calculateOrderTotal, filterActiveLineItems } from '../_shared/orderTotalCalculator.ts';
import { syncOrderItems } from '../_shared/orderItemsSync.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-shopify-hmac-sha256, x-shopify-shop-domain, x-shopify-topic',
};

interface ShopifyLineItemProperty {
  name: string;
  value: string;
}

interface ShopifyLineItem {
  id: number;
  name: string;
  quantity: number;
  price: string;
  product_id: number;
  variant_id: number;
  properties?: ShopifyLineItemProperty[];
}

interface ShopifyOrder {
  id: number;
  order_number: number;
  email: string;
  phone: string;
  customer: {
    id: number;
    email: string;
    phone: string;
    first_name: string;
    last_name: string;
  };
  shipping_address: {
    address1: string;
    address2?: string;
    city: string;
    province?: string;
    country: string;
    zip?: string;
  };
  line_items: ShopifyLineItem[];
  total_price: string;
  total_shipping_price_set?: {
    shop_money: { amount: string; currency_code: string; };
  };
  shipping_lines?: Array<{ price: string; title: string; }>;
  tags: string;
  note?: string;
  fulfillment_status?: string;
}

// Helper to extract Simple Bundles properties from line item
function getSimpleBundleInfo(item: ShopifyLineItem): { bundleTitle: string | null; bundleGroup: string | null } {
  if (!item.properties || item.properties.length === 0) {
    return { bundleTitle: null, bundleGroup: null };
  }
  
  const bundleTitleProp = item.properties.find(p => p.name === '_sb_bundle_title');
  const bundleGroupProp = item.properties.find(p => p.name === '_sb_bundle_group');
  
  return {
    bundleTitle: bundleTitleProp?.value || null,
    bundleGroup: bundleGroupProp?.value || null,
  };
}

async function verifyShopifyWebhook(body: string, hmacHeader: string, supabase: any): Promise<boolean> {
  // First try database, then fall back to env
  let webhookSecret = '';
  
  try {
    const { data } = await supabase
      .from('api_settings')
      .select('setting_value')
      .eq('setting_key', 'SHOPIFY_WEBHOOK_SECRET')
      .single();
    
    if (data?.setting_value) {
      webhookSecret = data.setting_value;
    }
  } catch (e) {
    console.log('Could not fetch webhook secret from DB, trying env');
  }
  
  // Fallback to env variable
  if (!webhookSecret) {
    webhookSecret = Deno.env.get('SHOPIFY_WEBHOOK_SECRET') || '';
  }
  
  if (!webhookSecret) {
    console.error('SHOPIFY_WEBHOOK_SECRET not configured in DB or env');
    return false;
  }

  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(webhookSecret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(body));
  const computedHmac = btoa(String.fromCharCode(...new Uint8Array(signature)));

  return computedHmac === hmacHeader;
}

/**
 * CRITICAL: ERP status is the source of truth
 * Only allow status change from Shopify for explicit cancellations
 * All other status changes MUST be done manually in ERP or via courier API
 */

// Map Shopify tracking company names to ERP courier codes
function mapShopifyTrackingCompanyToCourier(trackingCompany: string): string {
  const companyLower = trackingCompany.toLowerCase();
  
  if (companyLower.includes('leopard')) return 'leopard';
  if (companyLower.includes('tcs')) return 'tcs';
  if (companyLower.includes('postex') || companyLower.includes('post ex')) return 'postex';
  if (companyLower.includes('trax')) return 'trax';
  if (companyLower.includes('m&p')) return 'm&p';
  
  // Return original if no specific mapping found
  return trackingCompany;
}

async function fetchShopifyCustomerPhone(customerId: number, supabase: any): Promise<string> {
  try {
    // Get Shopify credentials from api_settings
    const { data: settings } = await supabase
      .from('api_settings')
      .select('setting_key, setting_value')
      .in('setting_key', ['SHOPIFY_STORE_URL', 'SHOPIFY_ADMIN_API_TOKEN', 'SHOPIFY_API_VERSION']);
    
    if (!settings || settings.length < 3) {
      console.warn('Shopify credentials not found in api_settings');
      return '';
    }
    
    const storeUrl = settings.find((s: any) => s.setting_key === 'SHOPIFY_STORE_URL')?.setting_value;
    const accessToken = settings.find((s: any) => s.setting_key === 'SHOPIFY_ADMIN_API_TOKEN')?.setting_value;
    const apiVersion = settings.find((s: any) => s.setting_key === 'SHOPIFY_API_VERSION')?.setting_value || '2024-01';
    
    if (!storeUrl || !accessToken) {
      console.warn('Incomplete Shopify credentials');
      return '';
    }
    
    // Fetch customer from Shopify
    const response = await fetch(`${storeUrl}/admin/api/${apiVersion}/customers/${customerId}.json`, {
      headers: {
        'X-Shopify-Access-Token': accessToken,
        'Content-Type': 'application/json',
      },
    });
    
    if (!response.ok) {
      console.warn(`Failed to fetch Shopify customer ${customerId}: ${response.status}`);
      return '';
    }
    
    const data = await response.json();
    const phone = data.customer?.phone || data.customer?.default_address?.phone;
    
    if (phone) {
      console.log(`Fetched phone from Shopify customer API for customer ${customerId}`);
      return phone;
    }
    
    return '';
  } catch (error) {
    console.error('Error fetching Shopify customer phone:', error);
    return '';
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get the raw body for HMAC verification
    const body = await req.text();
    const hmacHeader = req.headers.get('x-shopify-hmac-sha256');
    const shopDomain = req.headers.get('x-shopify-shop-domain');
    const topic = req.headers.get('x-shopify-topic');

    console.log('Received Shopify webhook:', { topic, shopDomain });

    // Verify webhook authenticity
    if (!hmacHeader || !(await verifyShopifyWebhook(body, hmacHeader, supabase))) {
      console.error('Invalid webhook signature');
      return new Response(JSON.stringify({ error: 'Invalid signature' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const order: ShopifyOrder = JSON.parse(body);

    // Check if customer exists, create or update
    let customerId: string | null = null;
    if (order.customer) {
      let normalizedPhone = order.customer.phone?.replace(/\D/g, '') || order.phone?.replace(/\D/g, '');
      
      // If no phone, try to fetch from Shopify customer API
      if (!normalizedPhone && order.customer.id) {
        console.log(`No phone in order ${order.id}, fetching from Shopify customer API`);
        const fetchedPhone = await fetchShopifyCustomerPhone(order.customer.id, supabase);
        normalizedPhone = fetchedPhone?.replace(/\D/g, '') || '';
        
        if (!normalizedPhone) {
          console.warn(`Unable to fetch phone for order ${order.id}, customer ${order.customer.id}`);
        }
      }
      
      // Step 1: Try to find by shopify_customer_id
      const { data: existingByShopify } = await supabase
        .from('customers')
        .select('id')
        .eq('shopify_customer_id', order.customer.id)
        .maybeSingle();

      if (existingByShopify) {
        customerId = existingByShopify.id;
        console.log(`Found customer by Shopify ID: ${customerId}`);
        
        // Update customer
        await supabase
          .from('customers')
          .update({
            name: `${order.customer.first_name} ${order.customer.last_name}`,
            email: order.customer.email,
            phone: normalizedPhone || '',
            updated_at: new Date().toISOString(),
          })
          .eq('id', customerId);
      } else {
        // Step 2: Try to find by normalized phone
        let existingByPhone = null;
        if (normalizedPhone) {
          const { data } = await supabase.rpc('normalize_phone', { p_phone: normalizedPhone });
          const normalized = data;
          
          if (normalized) {
            const { data: phoneMatch } = await supabase
              .from('customers')
              .select('id')
              .filter('phone', 'neq', null)
              .filter('phone', 'neq', '')
              .limit(100);
            
            // Find match by normalized phone in client
            existingByPhone = phoneMatch?.find(c => {
              const custNorm = c.phone?.replace(/\D/g, '');
              return custNorm === normalized;
            });
          }
        }
        
        if (existingByPhone) {
          customerId = existingByPhone.id;
          console.log(`Found customer by phone: ${customerId}, linking to Shopify ID ${order.customer.id}`);
          
          // Update existing customer with shopify_customer_id
          await supabase
            .from('customers')
            .update({
              shopify_customer_id: order.customer.id,
              name: `${order.customer.first_name} ${order.customer.last_name}`,
              email: order.customer.email,
              phone: normalizedPhone || '',
              updated_at: new Date().toISOString(),
            })
            .eq('id', customerId);
        } else {
          // Step 3: Try to find by email
          let existingByEmail = null;
          if (order.customer.email) {
            const { data: emailMatch } = await supabase
              .from('customers')
              .select('id')
              .ilike('email', order.customer.email)
              .maybeSingle();
            
            existingByEmail = emailMatch;
          }
          
          if (existingByEmail) {
            customerId = existingByEmail.id;
            console.log(`Found customer by email: ${customerId}, linking to Shopify ID ${order.customer.id}`);
            
            // Update existing customer with shopify_customer_id
            await supabase
              .from('customers')
              .update({
                shopify_customer_id: order.customer.id,
                name: `${order.customer.first_name} ${order.customer.last_name}`,
                phone: normalizedPhone || '',
                updated_at: new Date().toISOString(),
              })
              .eq('id', customerId);
          } else {
            // Step 4: Create new customer (no existing match found)
            console.log(`Creating new customer for Shopify ID ${order.customer.id}`);
            const { data: newCustomer } = await supabase
              .from('customers')
              .insert({
                name: `${order.customer.first_name} ${order.customer.last_name}`,
                email: order.customer.email,
                phone: normalizedPhone || '',
                phone_last_5_chr: normalizedPhone?.slice(-5) || '',
                shopify_customer_id: order.customer.id,
                total_orders: 0,
                return_count: 0,
              })
              .select('id')
              .single();
            
            customerId = newCustomer?.id || null;
          }
        }
      }
    }

    // Check if order already exists
    const { data: existingOrder } = await supabase
      .from('orders')
      .select('id')
      .eq('shopify_order_id', order.id)
      .single();

    // Prepare phone number
    let orderPhone = order.customer?.phone || order.phone || order.shipping_address?.phone || '';
    
    // If still no phone, try fetching from Shopify (if not already done above for customer)
    if (!orderPhone && order.customer?.id) {
      console.log(`No phone in order data for ${order.id}, attempting final fetch from Shopify`);
      orderPhone = await fetchShopifyCustomerPhone(order.customer.id, supabase);
    }
    
    const normalizedOrderPhone = orderPhone?.replace(/\D/g, '') || '';
    
    // Filter active line items
    const lineItems = order.line_items || [];
    const activeLineItems = filterActiveLineItems(lineItems);
    
    // Extract shipping charges from Shopify
    const shippingCharges = parseFloat(
      order.total_shipping_price_set?.shop_money?.amount || 
      order.shipping_lines?.reduce((sum, line) => sum + parseFloat(line.price || '0'), 0).toString() || 
      '0'
    );
    console.log(`Order ${order.order_number} shipping charges: ${shippingCharges}`);
    
    // Determine initial status (always pending, fulfillment doesn't mean delivered)
    const initialStatus = 'pending';
    
    // Prepare tags with initial Ecomnet status tag
    const shopifyTags = order.tags ? order.tags.split(',').map(t => t.trim()) : [];
    const ecomnetTag = getEcomnetStatusTag(initialStatus);
    const allTags = [...shopifyTags, ecomnetTag];
    
    // Add 'Shopify - Fulfilled' tag if order is fulfilled in Shopify
    if (order.fulfillment_status === 'fulfilled' && !allTags.includes('Shopify - Fulfilled')) {
      allTags.push('Shopify - Fulfilled');
      console.log(`Order ${order.order_number} marked fulfilled in Shopify, added tag`);
    }
    
    const orderData = {
      order_number: `SHOP-${order.order_number}`,
      shopify_order_number: order.order_number.toString(),
      shopify_order_id: order.id,
      customer_id: customerId,
      customer_name: `${order.customer?.first_name || ''} ${order.customer?.last_name || ''}`.trim() || 'Unknown',
      customer_email: order.customer?.email || order.email,
      customer_phone: normalizedOrderPhone,
      customer_phone_last_5_chr: normalizedOrderPhone?.slice(-5) || '',
      customer_address: order.shipping_address.address1,
      city: order.shipping_address.city,
      total_amount: calculateOrderTotal(lineItems, order.total_price, shippingCharges),
      shipping_charges: shippingCharges,
      total_items: activeLineItems.length.toString(),
      tags: allTags,
      notes: order.note,
      status: initialStatus,
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
    };

    if (existingOrder) {
      // Fetch current order state to preserve advanced statuses
      const { data: currentOrderState } = await supabase
        .from('orders')
        .select('status, courier, tracking_id, booked_at, dispatched_at, delivered_at')
        .eq('id', existingOrder.id)
        .single();
      
      // CRITICAL: ALWAYS preserve ERP status except for explicit cancellations
      // ERP status is the source of truth - only manual changes or courier API updates change it
      let finalStatus = currentOrderState.status; // Always use current ERP status
      
      // ONLY override if Shopify explicitly cancels the order
      if ((order as any).cancelled_at) {
        finalStatus = 'cancelled';
        console.log(`✓ Order ${order.order_number} cancelled in Shopify, updating ERP status to cancelled`);
      } else {
        console.log(`✓ Preserving ERP status for order ${order.order_number}:`, {
          erpStatus: currentOrderState.status,
          shopifyFulfillment: order.fulfillment_status,
          hasCourier: !!currentOrderState.courier,
          hasTracking: !!currentOrderState.tracking_id,
          note: 'ERP status is source of truth - not changed by Shopify webhooks'
        });
      }

      // Extract fulfillment data if available and ERP doesn't have it
      let extractedTracking = currentOrderState.tracking_id;
      let extractedCourier = currentOrderState.courier;

      // If Shopify has fulfillment data and ERP doesn't have tracking, extract it
      if ((order as any).fulfillments && (order as any).fulfillments.length > 0) {
        const fulfillment = (order as any).fulfillments[0];
        
        // Only fill in if ERP doesn't already have this data
        if (!currentOrderState.tracking_id && fulfillment.tracking_number) {
          extractedTracking = fulfillment.tracking_number;
          console.log(`✓ Extracted tracking from Shopify fulfillment: ${extractedTracking}`);
        }
        
        if (!currentOrderState.courier && fulfillment.tracking_company) {
          // Map Shopify tracking company to ERP courier code
          extractedCourier = mapShopifyTrackingCompanyToCourier(fulfillment.tracking_company);
          console.log(`✓ Extracted courier from Shopify fulfillment: ${fulfillment.tracking_company} -> ${extractedCourier}`);
        }
        
        // If we extracted tracking and status is still pending, update to booked
        if (extractedTracking && !currentOrderState.tracking_id && finalStatus === 'pending') {
          finalStatus = 'booked';
          console.log(`✓ Auto-updating status to booked (tracking extracted from Shopify)`);
        }
      }
      
      // Prepare final order data with preserved/extracted fields
      const finalOrderData = {
        ...orderData,
        status: finalStatus,
        // Use extracted data if ERP didn't have it, otherwise preserve ERP data
        courier: extractedCourier || orderData.courier,
        tracking_id: extractedTracking || orderData.tracking_id,
        booked_at: extractedTracking && !currentOrderState.tracking_id ? new Date().toISOString() : (currentOrderState?.booked_at || orderData.booked_at),
        dispatched_at: currentOrderState?.dispatched_at || orderData.dispatched_at,
        delivered_at: currentOrderState?.delivered_at || orderData.delivered_at,
      };
      
      // Update existing order with preserved data
      await supabase
        .from('orders')
        .update(finalOrderData)
        .eq('id', existingOrder.id);
      
      console.log('Updated existing order:', existingOrder.id);

      // SYNC ORDER ITEMS - Update order_items table from Shopify line items
      const itemsSyncResult = await syncOrderItems(
        supabase,
        existingOrder.id,
        order.line_items || [],
        true // isUpdate = true - will delete existing items first
      );
      
      console.log(`✓ Items synced for existing order: ${itemsSyncResult.itemsCreated} created, ${itemsSyncResult.itemsDeleted} deleted`);

      // Log order update activity with items sync info
      await supabase
        .from('activity_logs')
        .insert({
          action: 'order_updated',
          entity_type: 'order',
          entity_id: existingOrder.id,
          details: {
            shopify_order_id: order.id,
            order_number: orderData.order_number,
            customer_name: orderData.customer_name,
            previous_status: currentOrderState?.status,
            new_status: finalStatus,
            items_synced: {
              created: itemsSyncResult.itemsCreated,
              deleted: itemsSyncResult.itemsDeleted,
              matched: itemsSyncResult.matchedProducts,
              bundleComponents: itemsSyncResult.bundleComponents
            },
            source: 'shopify_webhook',
          },
          user_id: '00000000-0000-0000-0000-000000000000',
        });
    } else {
      // Create new order
      const { data: newOrder, error: orderError } = await supabase
        .from('orders')
        .insert(orderData)
        .select('id')
        .single();

      if (orderError) {
        console.error('Error creating order:', orderError);
        throw orderError;
      }

      // Create order items with product_id lookup and bundle detection
      if (newOrder && order.line_items.length > 0) {
        // Fetch all products for matching (include is_bundle flag)
        const { data: products } = await supabase
          .from('products')
          .select('id, name, shopify_product_id, is_bundle');
        
        // Fetch bundle components for all bundles (fixed bundles like "Top 3 Best Seller")
        const { data: bundleComponents } = await supabase
          .from('product_bundle_items')
          .select('bundle_product_id, component_product_id, quantity');
        
        const orderItems: any[] = [];
        
        // First, identify items that are part of Simple Bundles (customer choice bundles)
        // Group items by their _sb_bundle_group to link them together
        const simpleBundleGroups: Map<string, { bundleTitle: string; items: typeof order.line_items }> = new Map();
        const regularItems: typeof order.line_items = [];
        
        for (const item of order.line_items) {
          const { bundleTitle, bundleGroup } = getSimpleBundleInfo(item);
          
          if (bundleTitle && bundleGroup) {
            // This item is part of a Simple Bundle (customer choice)
            if (!simpleBundleGroups.has(bundleGroup)) {
              simpleBundleGroups.set(bundleGroup, { bundleTitle, items: [] });
            }
            simpleBundleGroups.get(bundleGroup)!.items.push(item);
          } else {
            // Regular item (not part of Simple Bundle)
            regularItems.push(item);
          }
        }
        
        // Log Simple Bundles detection
        if (simpleBundleGroups.size > 0) {
          console.log(`✓ Detected ${simpleBundleGroups.size} Simple Bundle(s) in order:`, 
            Array.from(simpleBundleGroups.entries()).map(([group, data]) => ({
              group,
              bundleTitle: data.bundleTitle,
              componentCount: data.items.length,
              components: data.items.map(i => i.name)
            }))
          );
        }
        
        // Process Simple Bundle items (customer choice bundles)
        for (const [bundleGroup, { bundleTitle, items }] of simpleBundleGroups) {
          // Find the bundle product in our system
          const bundleProduct = products?.find(p => 
            p.name.toLowerCase().trim() === bundleTitle.toLowerCase().trim() ||
            p.name.toLowerCase().includes(bundleTitle.toLowerCase()) ||
            bundleTitle.toLowerCase().includes(p.name.toLowerCase())
          );
          
          const bundleProductId = bundleProduct?.id || null;
          
          if (bundleProduct) {
            console.log(`✓ Matched Simple Bundle "${bundleTitle}" to product: ${bundleProduct.name} (${bundleProduct.id})`);
          } else {
            console.warn(`⚠ Could not match Simple Bundle "${bundleTitle}" to any product in system`);
          }
          
          // Create order items for each component in the bundle
          for (const item of items) {
            // Match component product
            let matchedProduct = products?.find(p => 
              p.shopify_product_id && p.shopify_product_id === item.product_id
            );
            
            if (!matchedProduct) {
              matchedProduct = products?.find(p => 
                p.name.toLowerCase().trim() === item.name.toLowerCase().trim()
              );
            }
            
            if (!matchedProduct) {
              matchedProduct = products?.find(p => 
                item.name.toLowerCase().includes(p.name.toLowerCase())
              );
            }
            
            orderItems.push({
              order_id: newOrder.id,
              item_name: item.name,
              quantity: item.quantity,
              price: parseFloat(item.price),
              product_id: matchedProduct?.id || null,
              shopify_product_id: item.product_id || null,
              shopify_variant_id: item.variant_id || null,
              bundle_product_id: bundleProductId,
              is_bundle_component: true,
              bundle_name: bundleTitle,
            });
          }
        }
        
        // Process regular items (including fixed bundles)
        for (const item of regularItems) {
          // Match by Shopify product ID first (most reliable)
          let matchedProduct = products?.find(p => 
            p.shopify_product_id && p.shopify_product_id === item.product_id
          );
          
          // Fallback to exact name match
          if (!matchedProduct) {
            matchedProduct = products?.find(p => 
              p.name.toLowerCase().trim() === item.name.toLowerCase().trim()
            );
          }
          
          // Fallback to partial name match
          if (!matchedProduct) {
            matchedProduct = products?.find(p => 
              item.name.toLowerCase().includes(p.name.toLowerCase())
            );
          }
          
          // Check if matched product is a FIXED bundle with components
          if (matchedProduct?.is_bundle) {
            const components = bundleComponents?.filter(bc => bc.bundle_product_id === matchedProduct.id) || [];
            
            if (components.length > 0) {
              // Create order items for each component with bundle reference
              for (const component of components) {
                const componentProduct = products?.find(p => p.id === component.component_product_id);
                orderItems.push({
                  order_id: newOrder.id,
                  item_name: componentProduct?.name || 'Unknown Component',
                  quantity: item.quantity * component.quantity,
                  price: 0, // Component price is included in bundle
                  product_id: component.component_product_id,
                  shopify_product_id: componentProduct?.shopify_product_id || null,
                  shopify_variant_id: null,
                  bundle_product_id: matchedProduct.id,
                  is_bundle_component: true,
                  bundle_name: matchedProduct.name,
                });
              }
              console.log(`✓ Fixed Bundle "${matchedProduct.name}" expanded to ${components.length} components`);
            } else {
              // Bundle without components - treat as regular product but mark as bundle
              orderItems.push({
                order_id: newOrder.id,
                item_name: item.name,
                quantity: item.quantity,
                price: parseFloat(item.price),
                product_id: matchedProduct?.id || null,
                shopify_product_id: item.product_id || null,
                shopify_variant_id: item.variant_id || null,
                bundle_product_id: null,
                is_bundle_component: false,
                bundle_name: null,
              });
              console.log(`⚠ Bundle "${matchedProduct.name}" has no components defined, treating as regular product`);
            }
          } else {
            // Regular product (not a bundle)
            orderItems.push({
              order_id: newOrder.id,
              item_name: item.name,
              quantity: item.quantity,
              price: parseFloat(item.price),
              product_id: matchedProduct?.id || null,
              shopify_product_id: item.product_id || null,
              shopify_variant_id: item.variant_id || null,
              bundle_product_id: null,
              is_bundle_component: false,
              bundle_name: null,
            });
          }
        }

        await supabase.from('order_items').insert(orderItems);
        
        const matchedCount = orderItems.filter(i => i.product_id).length;
        const bundleComponentCount = orderItems.filter(i => i.is_bundle_component).length;
        const simpleBundleComponentCount = Array.from(simpleBundleGroups.values()).reduce((sum, g) => sum + g.items.length, 0);
        console.log(`✓ Created ${orderItems.length} order items: ${matchedCount} matched to products, ${bundleComponentCount} bundle components (${simpleBundleComponentCount} from Simple Bundles)`);
      }

      console.log('Created new order:', newOrder?.id);
      
      // Log order creation activity
      if (newOrder) {
        await supabase
          .from('activity_logs')
          .insert({
            action: 'order_created',
            entity_type: 'order',
            entity_id: newOrder.id,
            details: {
              shopify_order_id: order.id,
              order_number: orderData.order_number,
              customer_name: orderData.customer_name,
              total_amount: orderData.total_amount,
              source: 'shopify_webhook',
            },
            user_id: '00000000-0000-0000-0000-000000000000',
          });
      }
      
      // Queue sync to push Ecomnet tag back to Shopify
      if (newOrder) {
        await supabase.from('sync_queue').insert({
          entity_type: 'order',
          entity_id: newOrder.id,
          action: 'update',
          direction: 'to_shopify',
          priority: 'normal',
          payload: {
            shopify_order_id: order.id,
            changes: {
              tags: allTags
            }
          },
          status: 'pending'
        });
        console.log('Queued initial Ecomnet tag sync to Shopify');
      }
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error processing Shopify webhook:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
