import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.2';
import { getEcomnetStatusTag } from '../_shared/ecomnetStatusTags.ts';
import { calculateOrderTotal, filterActiveLineItems } from '../_shared/orderTotalCalculator.ts';
import { syncOrderItems } from '../_shared/orderItemsSync.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-shopify-hmac-sha256, x-shopify-topic, x-shopify-shop-domain',
};

// HMAC verification for Shopify webhooks
async function verifyShopifyWebhook(body: string, hmacHeader: string, secret: string): Promise<boolean> {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(secret);
  const key = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(body));
  const hashArray = Array.from(new Uint8Array(signature));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  const calculatedHash = btoa(String.fromCharCode(...new Uint8Array(signature)));
  
  return calculatedHash === hmacHeader;
}

// Normalize phone number
function normalizePhone(phone: string | null): string | null {
  if (!phone) return null;
  return phone.replace(/[^0-9]/g, '');
}

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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get Shopify webhook secret
    const { data: webhookSecret } = await supabaseAdmin
      .from('api_settings')
      .select('setting_value')
      .eq('setting_key', 'SHOPIFY_WEBHOOK_SECRET')
      .single();

    // Read raw body for HMAC verification
    const body = await req.text();
    const hmacHeader = req.headers.get('x-shopify-hmac-sha256');
    const shopifyTopic = req.headers.get('x-shopify-topic');

    console.log(`Received Shopify webhook: ${shopifyTopic}`);

    // Verify HMAC if secret is configured
    if (webhookSecret?.setting_value && hmacHeader) {
      const isValid = await verifyShopifyWebhook(body, hmacHeader, webhookSecret.setting_value);
      if (!isValid) {
        console.error('Invalid HMAC signature');
        return new Response(
          JSON.stringify({ error: 'Invalid webhook signature' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      console.log('HMAC verification passed');
    } else {
      console.warn('HMAC verification skipped - no secret configured');
    }

    // Parse the order from Shopify
    const order = JSON.parse(body);

    if (!order || !order.id) {
      return new Response(
        JSON.stringify({ error: 'Invalid order data' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Processing Shopify order update: ${order.id} (${order.name})`);

    const lineItems = order.line_items || [];
    const activeLineItems = filterActiveLineItems(lineItems);
    const normalizedPhone = normalizePhone(order.customer?.phone || order.shipping_address?.phone);

    // Check if order exists and fetch current state
    const { data: currentOrderState } = await supabaseAdmin
      .from('orders')
      .select('id, status, courier, tracking_id, booked_at, dispatched_at, delivered_at')
      .eq('shopify_order_id', order.id.toString())
      .single();

    if (!currentOrderState) {
      console.log('Order not found in database, skipping update');
      return new Response(
        JSON.stringify({ success: false, message: 'Order not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // CRITICAL: ALWAYS preserve ERP status except for explicit cancellations
    // ERP status is the source of truth - only manual changes or courier API updates change it
    let preservedStatus = currentOrderState.status;
    
    // ONLY override if Shopify explicitly cancels the order
    if (order.cancelled_at) {
      preservedStatus = 'cancelled';
      console.log(`✓ Order cancelled in Shopify, updating ERP status to cancelled`);
    } else {
      console.log(`✓ Preserving ERP status: ${currentOrderState.status} (not affected by Shopify updates)`);
    }

    // Extract fulfillment data - use the LATEST active (non-cancelled) fulfillment
    let extractedTracking = currentOrderState.tracking_id;
    let extractedCourier = currentOrderState.courier;
    let trackingUpdated = false;

    if (order.fulfillments && order.fulfillments.length > 0) {
      // Filter to get only active (non-cancelled) fulfillments
      const activeFulfillments = order.fulfillments.filter((f: any) => 
        f.status !== 'cancelled' && f.status !== 'failure'
      );
      
      // Get the LATEST active fulfillment (last in array = most recent)
      const latestFulfillment = activeFulfillments.length > 0 
        ? activeFulfillments[activeFulfillments.length - 1] 
        : null;

      console.log(`Fulfillment analysis: total=${order.fulfillments.length}, active=${activeFulfillments.length}, using=${latestFulfillment?.id || 'none'}`);
      
      if (latestFulfillment) {
        // CRITICAL FIX: Update tracking if Shopify has a DIFFERENT tracking number
        // This handles re-booking scenarios where a new fulfillment was created
        if (latestFulfillment.tracking_number) {
          if (currentOrderState.tracking_id !== latestFulfillment.tracking_number) {
            extractedTracking = latestFulfillment.tracking_number;
            trackingUpdated = true;
            console.log(`✓ Tracking updated from Shopify: ${currentOrderState.tracking_id || 'none'} -> ${extractedTracking} (fulfillment ${latestFulfillment.id})`);
          } else {
            console.log(`✓ Tracking unchanged: ${extractedTracking}`);
          }
        }
        
        // Update courier if Shopify has it and it's different or ERP doesn't have it
        if (latestFulfillment.tracking_company) {
          const mappedCourier = mapShopifyTrackingCompanyToCourier(latestFulfillment.tracking_company);
          if (!currentOrderState.courier || (trackingUpdated && currentOrderState.courier !== mappedCourier)) {
            extractedCourier = mappedCourier;
            console.log(`✓ Courier extracted/updated: ${latestFulfillment.tracking_company} -> ${extractedCourier}`);
          }
        }
        
        // If we have new tracking and status is pending, update to booked
        if (trackingUpdated && preservedStatus === 'pending') {
          preservedStatus = 'booked';
          console.log(`✓ Auto-updating status to booked (new tracking from Shopify fulfillment)`);
        }
      } else {
        console.log(`No active fulfillments found (all ${order.fulfillments.length} are cancelled/failed)`);
      }
    }

    // Prepare tags: merge Shopify tags with Ecomnet status tag
    const shopifyTags = order.tags ? order.tags.split(',').map((t: string) => t.trim()).filter(Boolean) : [];
    const ecomnetTag = getEcomnetStatusTag(preservedStatus);
    
    // Remove any old Ecomnet status tags and add the current one
    const nonEcomnetTags = shopifyTags.filter((tag: string) => !tag.startsWith('Ecomnet - '));
    const allTags = [...nonEcomnetTags, ecomnetTag];
    
    // Add 'Shopify - Fulfilled' tag if order is fulfilled in Shopify (but don't change status)
    if (order.fulfillment_status === 'fulfilled' && !allTags.includes('Shopify - Fulfilled')) {
      allTags.push('Shopify - Fulfilled');
      console.log(`Order fulfilled in Shopify, added tag but preserved ERP status: ${preservedStatus}`);
    }

    // Build update data - accept address changes, preserve courier/tracking data
    const orderData: any = {
      shopify_order_number: order.order_number?.toString() || order.name,
      order_number: order.order_number?.toString() || order.name,
      customer_name: order.customer?.first_name && order.customer?.last_name
        ? `${order.customer.first_name} ${order.customer.last_name}`
        : order.customer?.first_name || 'Unknown',
      customer_email: order.customer?.email || null,
      customer_phone: normalizedPhone,
      customer_address: order.shipping_address?.address1 || null,
      city: order.shipping_address?.city || null,
      total_amount: calculateOrderTotal(lineItems, order.total_price || '0'),
      items: activeLineItems,
      notes: order.note || null,
      tags: allTags,
      last_shopify_sync: new Date().toISOString(),
      
      // Sync courier/tracking data (update if Shopify has newer data from rebooking)
      status: preservedStatus,
      courier: extractedCourier,
      tracking_id: extractedTracking,
      booked_at: trackingUpdated ? new Date().toISOString() : currentOrderState.booked_at,
      dispatched_at: currentOrderState.dispatched_at,
      delivered_at: currentOrderState.delivered_at,
    };

    // Update existing order
    const { error: updateError } = await supabaseAdmin
      .from('orders')
      .update(orderData)
      .eq('id', currentOrderState.id);

    if (updateError) throw updateError;

    // SYNC ORDER ITEMS - Update order_items table from Shopify line items
    // lineItems already declared at line 103
    const itemsSyncResult = await syncOrderItems(
      supabaseAdmin,
      currentOrderState.id,
      lineItems,
      true // isUpdate = true - will delete existing items first
    );

    console.log(`Successfully updated order: ${currentOrderState.id}`);
    console.log(`- Address updated from Shopify`);
    console.log(`- Tags synced: ${allTags.length} tags (${shopifyTags.length} from Shopify + Ecomnet status)`);
    console.log(`- Status: ${preservedStatus}`);
    console.log(`- Courier: ${extractedCourier || 'none'} ${extractedCourier !== currentOrderState.courier ? '(extracted from fulfillment)' : '(preserved)'}`);
    console.log(`- Tracking: ${extractedTracking || 'none'} ${extractedTracking !== currentOrderState.tracking_id ? '(extracted from fulfillment)' : '(preserved)'}`);
    console.log(`- Items synced: ${itemsSyncResult.itemsCreated} created, ${itemsSyncResult.itemsDeleted} deleted, ${itemsSyncResult.matchedProducts} matched`);

    // Log order update activity with items sync info
    await supabaseAdmin
      .from('activity_logs')
      .insert({
        action: 'order_updated_from_shopify',
        entity_type: 'order',
        entity_id: currentOrderState.id,
        details: {
          shopify_order_id: order.id,
          order_number: orderData.order_number,
          address_updated: true,
          status_preserved: preservedStatus,
          courier_preserved: currentOrderState.courier,
          items_synced: {
            created: itemsSyncResult.itemsCreated,
            deleted: itemsSyncResult.itemsDeleted,
            matched: itemsSyncResult.matchedProducts,
            bundleComponents: itemsSyncResult.bundleComponents
          },
          source: 'shopify_webhook',
        },
        user_id: '00000000-0000-0000-0000-000000000000', // System user
      });

    return new Response(
      JSON.stringify({ 
        success: true, 
        orderId: currentOrderState.id,
        tagsCount: allTags.length,
        itemsSynced: itemsSyncResult,
        message: 'Order updated - address, tags & items synced from Shopify, local courier data preserved'
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('Error handling Shopify order update:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
