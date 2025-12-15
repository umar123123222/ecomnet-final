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

    // Get webhook secret from database first, then env
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
      console.log('Could not fetch webhook secret from DB');
    }
    if (!webhookSecret) {
      webhookSecret = Deno.env.get('SHOPIFY_WEBHOOK_SECRET') || '';
    }

    // Verify webhook signature
    if (webhookSecret && hmacHeader) {
      const isValid = verifyWebhook(bodyText, hmacHeader, webhookSecret);
      if (!isValid) {
        console.error('Invalid webhook signature');
        return new Response(JSON.stringify({ error: 'Invalid signature' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    } else {
      console.warn('HMAC verification skipped - no secret or header');
    }

    const product = JSON.parse(bodyText);
    console.log(`Received product ${topic === 'products/create' ? 'create' : 'update'} webhook for ${product.id}`);

    // Update webhook registry
    await supabase
      .from('shopify_webhook_registry')
      .update({ last_triggered: new Date().toISOString() })
      .eq('topic', topic || 'products/update');

    // Find product in our database
    const { data: existingProduct, error: findError } = await supabase
      .from('products')
      .select('id')
      .eq('shopify_product_id', product.id.toString())
      .single();

    const productData = {
      name: product.title,
      description: product.body_html || '',
      price: product.variants?.[0]?.price || 0,
      sku: product.variants?.[0]?.sku || '',
      barcode: product.variants?.[0]?.barcode || '',
      shopify_product_id: product.id.toString(),
      shopify_inventory_item_id: product.variants?.[0]?.inventory_item_id || null,
      is_active: product.status === 'active',
    };

    if (existingProduct) {
      // Update existing product
      await supabase
        .from('products')
        .update(productData)
        .eq('id', existingProduct.id);

      console.log(`Updated product ${existingProduct.id}`);
    } else if (topic === 'products/create') {
      // Create new product
      await supabase
        .from('products')
        .insert({
          ...productData,
          category: 'General',
          unit: 'pcs',
        });

      console.log(`Created new product from Shopify: ${product.title}`);
    }

    // Log the sync
    await supabase.from('shopify_sync_log').insert({
      sync_type: topic === 'products/create' ? 'product_create_webhook' : 'product_update_webhook',
      status: 'success',
      records_processed: 1,
      details: {
        shopify_product_id: product.id,
        product_title: product.title,
      },
    });

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error handling product webhook:', error);
    
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