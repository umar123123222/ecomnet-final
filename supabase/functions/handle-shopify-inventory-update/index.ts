import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.2';
import { createHmac } from 'https://deno.land/std@0.177.0/node/crypto.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-shopify-hmac-sha256, x-shopify-topic',
};

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
    console.log(`Received inventory update webhook for item ${inventoryLevel.inventory_item_id}`);

    // Update webhook registry
    await supabase
      .from('shopify_webhook_registry')
      .update({ last_triggered: new Date().toISOString() })
      .eq('topic', topic || 'inventory_levels/update');

    // Find product by shopify_inventory_item_id
    const { data: product, error: productError } = await supabase
      .from('products')
      .select('id')
      .eq('shopify_inventory_item_id', inventoryLevel.inventory_item_id)
      .single();

    if (productError || !product) {
      console.log(`Product not found for Shopify inventory item ${inventoryLevel.inventory_item_id}`);
      return new Response(JSON.stringify({ success: true, message: 'Product not found' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Update inventory for this product
    // Note: We need to decide which outlet to update. For now, update the first one found
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
          quantity: inventoryLevel.available || 0,
          last_shopify_sync: new Date().toISOString(),
        })
        .eq('id', inventory.id);

      console.log(`Updated inventory for product ${product.id} to ${inventoryLevel.available}`);
    }

    // Log the sync
    await supabase.from('shopify_sync_log').insert({
      sync_type: 'inventory_update_webhook',
      status: 'success',
      records_processed: 1,
      details: {
        shopify_inventory_item_id: inventoryLevel.inventory_item_id,
        product_id: product.id,
        available: inventoryLevel.available,
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