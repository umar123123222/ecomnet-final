import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.2';
import { createHmac } from 'https://deno.land/std@0.177.0/node/crypto.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-shopify-hmac-sha256, x-shopify-topic',
};

// Maximum reasonable inventory value - anything above this is likely a Shopify placeholder
const MAX_REASONABLE_INVENTORY = 100000;

function verifyWebhook(body: string, hmacHeader: string, secret: string): boolean {
  const hash = createHmac('sha256', secret)
    .update(body, 'utf8')
    .digest('base64');
  return hash === hmacHeader;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get webhook headers
    const hmacHeader = req.headers.get('x-shopify-hmac-sha256');
    const topic = req.headers.get('x-shopify-topic');

    // Get body as text for HMAC verification
    const bodyText = await req.text();

    // Verify webhook signature
    const webhookSecret = Deno.env.get('SHOPIFY_WEBHOOK_SECRET');
    if (webhookSecret && hmacHeader) {
      const isValid = verifyWebhook(bodyText, hmacHeader, webhookSecret);
      if (!isValid) {
        console.error('Invalid webhook signature');
        return new Response(JSON.stringify({ error: 'Invalid signature' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    const inventoryLevel = JSON.parse(bodyText);
    const availableQuantity = inventoryLevel.available || 0;
    console.log(`Received inventory update webhook for item ${inventoryLevel.inventory_item_id}, quantity: ${availableQuantity}`);

    // Update webhook registry
    await supabase
      .from('shopify_webhook_registry')
      .update({ last_triggered: new Date().toISOString() })
      .eq('topic', topic || 'inventory_levels/update');

    // Sanity check: reject unreasonably large inventory values
    if (availableQuantity > MAX_REASONABLE_INVENTORY) {
      console.warn(`SKIPPED: Unreasonable inventory value ${availableQuantity} for item ${inventoryLevel.inventory_item_id} (exceeds ${MAX_REASONABLE_INVENTORY})`);
      
      // Log the skipped sync
      await supabase.from('shopify_sync_log').insert({
        sync_type: 'inventory_update_webhook',
        status: 'skipped',
        records_processed: 0,
        details: {
          shopify_inventory_item_id: inventoryLevel.inventory_item_id,
          available: availableQuantity,
          reason: `Inventory value ${availableQuantity} exceeds maximum reasonable limit of ${MAX_REASONABLE_INVENTORY}`,
        },
      });

      return new Response(JSON.stringify({ 
        success: true, 
        message: 'Skipped - unreasonable inventory value',
        skipped: true 
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Find product by shopify_inventory_item_id - also fetch is_bundle and name
    const { data: product, error: productError } = await supabase
      .from('products')
      .select('id, name, is_bundle')
      .eq('shopify_inventory_item_id', inventoryLevel.inventory_item_id)
      .single();

    if (productError || !product) {
      console.log(`Product not found for Shopify inventory item ${inventoryLevel.inventory_item_id}`);
      return new Response(JSON.stringify({ success: true, message: 'Product not found' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Check if product is a bundle - bundles use calculated availability, not Shopify inventory
    const isBundleProduct = product.is_bundle || 
      product.name?.toLowerCase().includes('bundle') || 
      product.name?.toLowerCase().includes('deal') ||
      product.name?.toLowerCase().includes('combo');

    if (isBundleProduct) {
      console.log(`SKIPPED: Product ${product.id} (${product.name}) is a bundle - inventory managed by component availability`);
      
      // Log the skipped sync
      await supabase.from('shopify_sync_log').insert({
        sync_type: 'inventory_update_webhook',
        status: 'skipped',
        records_processed: 0,
        details: {
          shopify_inventory_item_id: inventoryLevel.inventory_item_id,
          product_id: product.id,
          product_name: product.name,
          available: availableQuantity,
          reason: 'Bundle products use calculated availability from components',
        },
      });

      return new Response(JSON.stringify({ 
        success: true, 
        message: 'Skipped - bundle product',
        skipped: true 
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Update inventory for this product
    const { data: inventory, error: inventoryError } = await supabase
      .from('inventory')
      .select('id')
      .eq('product_id', product.id)
      .limit(1)
      .single();

    if (inventory) {
      await supabase
        .from('inventory')
        .update({
          quantity: availableQuantity,
          last_shopify_sync: new Date().toISOString(),
        })
        .eq('id', inventory.id);

      console.log(`Updated inventory for product ${product.id} (${product.name}) to ${availableQuantity}`);
    }

    // Log the sync
    await supabase.from('shopify_sync_log').insert({
      sync_type: 'inventory_update_webhook',
      status: 'success',
      records_processed: 1,
      details: {
        shopify_inventory_item_id: inventoryLevel.inventory_item_id,
        product_id: product.id,
        product_name: product.name,
        available: availableQuantity,
      },
    });

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error handling inventory update webhook:', error);
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message 
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
