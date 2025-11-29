import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.2';
import { getAPISetting } from '../_shared/apiSettings.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ShopifyProduct {
  id: number;
  title: string;
  body_html?: string;
  product_type?: string;
  variants: Array<{
    id: number;
    title: string;
    sku: string;
    price: string;
    compare_at_price?: string;
    inventory_quantity?: number;
  }>;
}

async function fetchShopifyProducts(storeUrl: string, apiToken: string, apiVersion: string, cursor?: string): Promise<{ products: ShopifyProduct[]; nextCursor?: string }> {

  const query = `
    query GetProducts($cursor: String) {
      products(first: 50, after: $cursor) {
        pageInfo {
          hasNextPage
          endCursor
        }
        nodes {
          id
          title
          descriptionHtml
          productType
          variants(first: 10) {
            nodes {
              id
              title
              sku
              price
              compareAtPrice
              inventoryQuantity
            }
          }
        }
      }
    }
  `;

  const response = await fetch(`${storeUrl}/admin/api/${apiVersion}/graphql.json`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Shopify-Access-Token': apiToken!,
    },
    body: JSON.stringify({
      query,
      variables: { cursor },
    }),
  });

  if (!response.ok) {
    throw new Error(`Shopify API error: ${response.statusText}`);
  }

  const result = await response.json();
  
  const products = result.data.products.nodes.map((node: any) => ({
    id: parseInt(node.id.split('/').pop()),
    title: node.title,
    body_html: node.descriptionHtml,
    product_type: node.productType,
    variants: node.variants.nodes.map((v: any) => ({
      id: parseInt(v.id.split('/').pop()),
      title: v.title,
      sku: v.sku,
      price: v.price,
      compare_at_price: v.compareAtPrice,
      inventory_quantity: v.inventoryQuantity || 0,
    })),
  }));

  return {
    products,
    nextCursor: result.data.products.pageInfo.hasNextPage 
      ? result.data.products.pageInfo.endCursor 
      : undefined,
  };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data: authData } = await supabase.auth.getUser(
      req.headers.get('Authorization')?.replace('Bearer ', '') || ''
    );

    if (!authData.user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('Starting Shopify product sync...');
    
    // Get Shopify credentials
    const storeUrl = await getAPISetting('SHOPIFY_STORE_URL', supabase);
    const apiToken = await getAPISetting('SHOPIFY_ADMIN_API_TOKEN', supabase);
    const apiVersion = await getAPISetting('SHOPIFY_API_VERSION', supabase) || '2024-01';

    if (!storeUrl || !apiToken) {
      throw new Error('Shopify credentials not configured');
    }

    let totalSynced = 0;
    let cursor: string | undefined;
    let hasMore = true;

    // Log sync start
    const { data: syncLog } = await supabase
      .from('shopify_sync_log')
      .insert({
        sync_type: 'products',
        sync_direction: 'from_shopify',
        status: 'in_progress',
        triggered_by: authData.user.id,
      })
      .select('id')
      .single();

    try {
      while (hasMore) {
        const { products, nextCursor } = await fetchShopifyProducts(storeUrl, apiToken, apiVersion, cursor);
        console.log(`Fetched ${products.length} products. Total synced so far: ${totalSynced}`);
        
        for (const product of products) {
          // Check if parent product exists
          const { data: existingProduct } = await supabase
            .from('products')
            .select('id')
            .eq('shopify_product_id', product.id)
            .single();

          let parentProductId = existingProduct?.id;

          // Create or update parent product (using first variant as base)
          const firstVariant = product.variants[0];
          
          // SKU is optional - use null if not provided
          const productSku = firstVariant?.sku || null;

          const productData = {
            name: product.title,
            sku: productSku,
            price: parseFloat(firstVariant.price),
            cost: firstVariant.compare_at_price ? parseFloat(firstVariant.compare_at_price) : null,
            description: product.body_html,
            category: product.product_type,
            shopify_product_id: product.id,
            shopify_variant_id: firstVariant.id, // Primary variant
            synced_from_shopify: true,
            updated_at: new Date().toISOString(),
          };

          if (parentProductId) {
            await supabase
              .from('products')
              .update(productData)
              .eq('id', parentProductId);
          } else {
            const { data: newProduct } = await supabase
              .from('products')
              .insert(productData)
              .select('id')
              .single();
            parentProductId = newProduct?.id;
          }

          if (!parentProductId) {
            console.error(`Failed to create/update product: ${product.title}`);
            continue;
          }

          // Now sync all variants
          for (const variant of product.variants) {
            // SKU is optional - use null if not provided
            const variantSku = variant.sku || null;

            // Check if variant exists
            const { data: existingVariant } = await supabase
              .from('product_variants')
              .select('id')
              .eq('shopify_variant_id', variant.id)
              .single();

            const variantData = {
              product_id: parentProductId,
              variant_name: variant.title !== 'Default Title' ? variant.title : 'Standard',
              variant_type: variant.title !== 'Default Title' ? 'size' : null,
              sku: variantSku,
              price_adjustment: parseFloat(variant.price) - parseFloat(firstVariant.price),
              cost_adjustment: variant.compare_at_price && firstVariant.compare_at_price 
                ? parseFloat(variant.compare_at_price) - parseFloat(firstVariant.compare_at_price)
                : 0,
              shopify_variant_id: variant.id,
              is_active: true,
              updated_at: new Date().toISOString(),
            };

            if (existingVariant) {
              await supabase
                .from('product_variants')
                .update(variantData)
                .eq('id', existingVariant.id);
            } else {
              await supabase
                .from('product_variants')
                .insert(variantData);
            }

            totalSynced++;
          }
        }

        cursor = nextCursor;
        hasMore = !!nextCursor;
        
        if (hasMore) {
          console.log('Fetching next page of products...');
        }
      }

      // Update sync log
      if (syncLog) {
        await supabase
          .from('shopify_sync_log')
          .update({
            status: 'success',
            records_processed: totalSynced,
            records_failed: 0,
            completed_at: new Date().toISOString(),
          })
          .eq('id', syncLog.id);
      }

      console.log(`Successfully synced ${totalSynced} products`);

      return new Response(
        JSON.stringify({ 
          success: true, 
          synced: totalSynced,
          message: `Successfully synced ${totalSynced} products from Shopify`,
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
    console.error('Error syncing Shopify products:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
