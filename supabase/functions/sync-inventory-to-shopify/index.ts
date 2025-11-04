import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.2';
import { getAPISetting } from '../_shared/apiSettings.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SyncInventoryRequest {
  inventory_id: string;
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

    // Verify authentication
    const authHeader = req.headers.get('Authorization')!;
    const { data: { user }, error: authError } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));
    
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { inventory_id } = await req.json() as SyncInventoryRequest;

    // Get inventory details with product info
    const { data: inventory, error: inventoryError } = await supabase
      .from('inventory')
      .select(`
        *,
        products (
          id,
          name,
          sku,
          shopify_product_id,
          shopify_inventory_item_id,
          sync_to_shopify
        )
      `)
      .eq('id', inventory_id)
      .single();

    if (inventoryError || !inventory) {
      throw new Error('Inventory record not found');
    }

    // Check if product should sync
    if (!inventory.products?.sync_to_shopify) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Product sync disabled',
          skipped: true
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!inventory.products?.shopify_inventory_item_id) {
      throw new Error('Product not linked to Shopify (missing inventory_item_id)');
    }

    // Get Shopify credentials
    const storeUrl = await getAPISetting('SHOPIFY_STORE_URL', supabase);
    const accessToken = await getAPISetting('SHOPIFY_ADMIN_API_TOKEN', supabase);
    const apiVersion = await getAPISetting('SHOPIFY_API_VERSION', supabase) || '2024-01';
    const locationId = await getAPISetting('SHOPIFY_LOCATION_ID', supabase) || inventory.shopify_location_id;

    if (!storeUrl || !accessToken || !locationId) {
      throw new Error('Shopify credentials or location not configured');
    }

    // Update inventory level in Shopify
    const shopifyResponse = await fetch(
      `https://${storeUrl}/admin/api/${apiVersion}/inventory_levels/set.json`,
      {
        method: 'POST',
        headers: {
          'X-Shopify-Access-Token': accessToken,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          location_id: locationId,
          inventory_item_id: inventory.products.shopify_inventory_item_id,
          available: inventory.available_quantity || 0,
        }),
      }
    );

    if (!shopifyResponse.ok) {
      const errorText = await shopifyResponse.text();
      throw new Error(`Shopify API error: ${shopifyResponse.status} - ${errorText}`);
    }

    const shopifyData = await shopifyResponse.json();

    // Update local inventory record
    await supabase
      .from('inventory')
      .update({
        last_shopify_sync: new Date().toISOString(),
        shopify_location_id: locationId,
      })
      .eq('id', inventory_id);

    // Log sync
    await supabase.from('shopify_sync_log').insert({
      sync_type: 'inventory_update',
      status: 'success',
      records_processed: 1,
      details: {
        inventory_id,
        product_id: inventory.product_id,
        quantity: inventory.available_quantity,
        shopify_inventory_item_id: inventory.products.shopify_inventory_item_id,
      },
    });

    return new Response(
      JSON.stringify({
        success: true,
        updated: true,
        available_quantity: inventory.available_quantity,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error syncing inventory to Shopify:', error);
    
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