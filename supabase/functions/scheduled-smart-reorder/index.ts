import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface AutomationResult {
  success: boolean;
  products_updated: number;
  packaging_updated: number;
  pos_generated: number;
  errors: string[];
  duration_ms: number;
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  const result: AutomationResult = {
    success: true,
    products_updated: 0,
    packaging_updated: 0,
    pos_generated: 0,
    errors: [],
    duration_ms: 0,
  };

  try {
    console.log('Starting scheduled smart reorder automation...');
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    // Use service role for admin access
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Step 1: Update velocity for all products with auto-reorder enabled
    console.log('Step 1: Updating product velocities...');
    const { data: products, error: productsError } = await supabase
      .from('products')
      .select('id')
      .eq('auto_reorder_enabled', true)
      .eq('is_active', true);

    if (productsError) {
      console.error('Error fetching products:', productsError);
      result.errors.push(`Failed to fetch products: ${productsError.message}`);
    } else if (products) {
      for (const product of products) {
        try {
          const { error: velocityError } = await supabase.functions.invoke('smart-reorder', {
            body: {
              action: 'update_velocity',
              product_id: product.id,
              days_to_analyze: 30,
            },
          });

          if (velocityError) {
            console.error(`Error updating velocity for product ${product.id}:`, velocityError);
            result.errors.push(`Product ${product.id}: ${velocityError.message}`);
          } else {
            result.products_updated++;
          }
        } catch (err) {
          console.error(`Exception updating product ${product.id}:`, err);
          result.errors.push(`Product ${product.id}: ${err.message}`);
        }
      }
    }

    // Step 2: Update velocity for all packaging items with auto-reorder enabled
    console.log('Step 2: Updating packaging item velocities...');
    const { data: packagingItems, error: packagingError } = await supabase
      .from('packaging_items')
      .select('id')
      .eq('auto_reorder_enabled', true)
      .eq('is_active', true);

    if (packagingError) {
      console.error('Error fetching packaging items:', packagingError);
      result.errors.push(`Failed to fetch packaging: ${packagingError.message}`);
    } else if (packagingItems) {
      for (const item of packagingItems) {
        try {
          const { error: velocityError } = await supabase.functions.invoke('smart-reorder', {
            body: {
              action: 'update_velocity',
              packaging_item_id: item.id,
              days_to_analyze: 30,
            },
          });

          if (velocityError) {
            console.error(`Error updating velocity for packaging ${item.id}:`, velocityError);
            result.errors.push(`Packaging ${item.id}: ${velocityError.message}`);
          } else {
            result.packaging_updated++;
          }
        } catch (err) {
          console.error(`Exception updating packaging ${item.id}:`, err);
          result.errors.push(`Packaging ${item.id}: ${err.message}`);
        }
      }
    }

    // Step 3: Get recommendations and generate POs
    console.log('Step 3: Getting recommendations and generating POs...');
    const { data: recommendations, error: recError } = await supabase.functions.invoke('smart-reorder', {
      body: { action: 'get_recommendations' },
    });

    if (recError) {
      console.error('Error getting recommendations:', recError);
      result.errors.push(`Failed to get recommendations: ${recError.message}`);
    } else if (recommendations?.success && recommendations?.recommendations) {
      const recsData = recommendations.recommendations;
      
      console.log(`Processing ${recsData.length} recommendations`);
      
      for (const rec of recsData) {
        if (rec.recommended_quantity <= 0) continue;

        try {
          // Check if PO was generated in last 7 days to avoid duplicates
          const metadataKey = rec.type === 'product' ? 'metadata->>product_id' : 'metadata->>packaging_item_id';
          const { data: recentPO, error: checkError } = await supabase
            .from('auto_purchase_orders')
            .select('id')
            .eq(metadataKey, rec.item_id)
            .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
            .limit(1);

          if (checkError) {
            console.error('Error checking recent POs:', checkError);
            continue;
          }

          if (recentPO && recentPO.length > 0) {
            console.log(`Skipping ${rec.type} ${rec.item_id} (${rec.item_name}) - PO generated within last 7 days`);
            continue;
          }

          // Generate PO
          const poBody = {
            action: 'generate_po',
            [rec.type === 'product' ? 'product_id' : 'packaging_item_id']: rec.item_id,
          };
          
          console.log(`Generating PO for ${rec.type} ${rec.item_name}:`, poBody);
          
          const { data: poData, error: poError } = await supabase.functions.invoke('smart-reorder', {
            body: poBody,
          });

          if (poError) {
            console.error(`Error generating PO for ${rec.type} ${rec.item_id}:`, poError);
            result.errors.push(`PO for ${rec.type} ${rec.item_id}: ${poError.message}`);
          } else if (poData?.success && poData?.po_number) {
            result.pos_generated++;
            console.log(`Generated PO for ${rec.type} ${rec.item_name}: ${poData.po_number}`);

            // Create notification for managers
            const { data: managers } = await supabase
              .from('user_roles')
              .select('user_id')
              .in('role', ['super_admin', 'super_manager', 'warehouse_manager'])
              .eq('is_active', true);

            if (managers) {
              for (const manager of managers) {
                await supabase.from('notifications').insert({
                  user_id: manager.user_id,
                  type: 'purchase_order',
                  priority: 'high',
                  title: 'Auto-Generated Purchase Order',
                  message: `PO ${poData.po_number} created for ${rec.item_name} (Qty: ${rec.recommended_quantity})`,
                  metadata: {
                    po_id: poData.po_id,
                    po_number: poData.po_number,
                    item_type: rec.type,
                    item_id: rec.item_id,
                    item_name: rec.item_name,
                  },
                  action_url: '/purchase-orders',
                });
              }
            }
          }
        } catch (err) {
          console.error(`Exception generating PO for ${rec.type} ${rec.item_id}:`, err);
          result.errors.push(`PO for ${rec.type} ${rec.item_id}: ${err.message}`);
        }
      }
    }

    result.duration_ms = Date.now() - startTime;
    
    if (result.errors.length > 0) {
      result.success = false;
    }

    console.log('Automation completed:', result);

    return new Response(
      JSON.stringify(result),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: result.success ? 200 : 207, // 207 Multi-Status if partial success
      }
    );
  } catch (error) {
    console.error('Fatal error in automation:', error);
    result.success = false;
    result.errors.push(`Fatal error: ${error.message}`);
    result.duration_ms = Date.now() - startTime;

    return new Response(
      JSON.stringify(result),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
