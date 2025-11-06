import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.2';
import { getAPISetting } from '../_shared/apiSettings.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Verify authentication
    const authHeader = req.headers.get('Authorization')!;
    const { data: { user }, error: authError } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));
    
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get Shopify credentials
    const storeUrl = await getAPISetting('SHOPIFY_STORE_URL', supabase);
    const accessToken = await getAPISetting('SHOPIFY_ADMIN_API_TOKEN', supabase);
    const apiVersion = await getAPISetting('SHOPIFY_API_VERSION', supabase) || '2024-01';

    if (!storeUrl || !accessToken) {
      throw new Error('Shopify credentials not configured');
    }

    // Clean store URL - remove protocol if present
    const cleanStoreUrl = storeUrl.replace(/^https?:\/\//, '');

    const baseWebhookUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1`;

    // Define webhooks to register
    const webhooks = [
      {
        topic: 'orders/create',
        address: `${baseWebhookUrl}/shopify-webhook-orders`,
      },
      {
        topic: 'orders/updated',
        address: `${baseWebhookUrl}/handle-shopify-order-update`,
      },
      {
        topic: 'orders/fulfilled',
        address: `${baseWebhookUrl}/handle-shopify-order-update`,
      },
      {
        topic: 'orders/cancelled',
        address: `${baseWebhookUrl}/handle-shopify-order-update`,
      },
      {
        topic: 'inventory_levels/update',
        address: `${baseWebhookUrl}/handle-shopify-inventory-update`,
      },
      {
        topic: 'products/update',
        address: `${baseWebhookUrl}/handle-shopify-product-update`,
      },
      {
        topic: 'products/create',
        address: `${baseWebhookUrl}/handle-shopify-product-update`,
      },
    ];

    const registered: any[] = [];
    const errors: any[] = [];

    // Get existing webhooks
    const existingResponse = await fetch(
      `https://${cleanStoreUrl}/admin/api/${apiVersion}/webhooks.json`,
      {
        method: 'GET',
        headers: {
          'X-Shopify-Access-Token': accessToken,
          'Content-Type': 'application/json',
        },
      }
    );

    const existingData = await existingResponse.json();
    const existingWebhooks = existingData.webhooks || [];

    console.log(`Found ${existingWebhooks.length} existing webhooks`);

    // Register each webhook
    for (const webhook of webhooks) {
      try {
        // Check if webhook already exists
        const existing = existingWebhooks.find(
          (w: any) => w.topic === webhook.topic && w.address === webhook.address
        );

        if (existing) {
          console.log(`Webhook already exists: ${webhook.topic}`);
          
          // Update registry
          await supabase
            .from('shopify_webhook_registry')
            .upsert({
              webhook_id: existing.id,
              topic: webhook.topic,
              address: webhook.address,
              status: 'active',
            }, { onConflict: 'webhook_id' });

          registered.push({
            topic: webhook.topic,
            webhook_id: existing.id,
            status: 'existing',
          });
          continue;
        }

        // Register new webhook
        const response = await fetch(
          `https://${cleanStoreUrl}/admin/api/${apiVersion}/webhooks.json`,
          {
            method: 'POST',
            headers: {
              'X-Shopify-Access-Token': accessToken,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              webhook: {
                topic: webhook.topic,
                address: webhook.address,
                format: 'json',
              },
            }),
          }
        );

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Failed to register ${webhook.topic}: ${errorText}`);
        }

        const data = await response.json();
        const createdWebhook = data.webhook;

        // Save to registry
        await supabase
          .from('shopify_webhook_registry')
          .insert({
            webhook_id: createdWebhook.id,
            topic: webhook.topic,
            address: webhook.address,
            status: 'active',
          });

        registered.push({
          topic: webhook.topic,
          webhook_id: createdWebhook.id,
          status: 'created',
        });

        console.log(`Registered webhook: ${webhook.topic} (ID: ${createdWebhook.id})`);

      } catch (error) {
        console.error(`Error registering webhook ${webhook.topic}:`, error);
        errors.push({
          topic: webhook.topic,
          error: error.message,
        });
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        registered,
        errors,
        total: webhooks.length,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error registering webhooks:', error);
    
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