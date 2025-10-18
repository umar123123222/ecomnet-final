import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    );

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      throw new Error('Unauthorized');
    }

    const body = await req.json();
    
    // Handle both camelCase (frontend) and snake_case (backend) parameter naming
    const barcode = body.barcode;
    const scan_type = body.scanType || body.scan_type || 'product';
    const scan_method = body.method || body.scan_method || 'manual';
    const outlet_id = body.outletId || body.outlet_id;
    const context = body.context || {};

    console.log('Processing scan:', { barcode, scan_type, user_id: user.id });

    // Match barcode to product
    const { data: productId, error: matchError } = await supabase
      .rpc('match_barcode_to_product', { p_barcode: barcode });

    if (matchError) {
      console.error('Error matching barcode:', matchError);
    }

    let processing_status = 'processed';
    let processing_notes = '';
    let product_id = productId;

    if (!product_id) {
      // Check if this is a SKU
      const { data: productBySKU } = await supabase
        .from('products')
        .select('id')
        .eq('sku', barcode)
        .eq('is_active', true)
        .maybeSingle();

      if (productBySKU) {
        product_id = productBySKU.id;
      } else {
        processing_status = 'failed';
        processing_notes = 'Product not found';
      }
    }

    // Check for duplicates in last 5 seconds (debounce)
    const fiveSecondsAgo = new Date(Date.now() - 5000).toISOString();
    const { data: recentScans } = await supabase
      .from('scans')
      .select('id')
      .eq('barcode', barcode)
      .eq('scanned_by', user.id)
      .gte('created_at', fiveSecondsAgo)
      .limit(1);

    if (recentScans && recentScans.length > 0) {
      processing_status = 'duplicate';
      processing_notes = 'Duplicate scan detected (debounced)';
    }

    // Create scan record
    const { data: scan, error: scanError } = await supabase
      .from('scans')
      .insert({
        barcode,
        scan_type,
        scan_method,
        scanned_by: user.id,
        product_id,
        outlet_id,
        raw_data: barcode,
        processed: processing_status === 'processed',
        processing_status,
        processing_notes,
        device_info: context?.device_info || {},
        location_data: context?.location_data || {},
        processed_at: processing_status === 'processed' ? new Date().toISOString() : null,
      })
      .select()
      .single();

    if (scanError) {
      console.error('Error creating scan:', scanError);
      throw scanError;
    }

    // Get product details if found
    let product = null;
    if (product_id) {
      const { data: productData } = await supabase
        .from('products')
        .select('*, supplier:suppliers(name)')
        .eq('id', product_id)
        .single();
      
      product = productData;
    }

    // Update context-specific data
    if (processing_status === 'processed' && product_id) {
      // Update stock count if in stock count context
      if (context?.stock_count_item_id) {
        await supabase
          .from('stock_count_items')
          .update({
            scanned: true,
            scan_timestamp: new Date().toISOString(),
            scanned_by: user.id,
          })
          .eq('id', context.stock_count_item_id);
      }

      // Create notification for low stock if applicable
      if (product && context?.check_stock) {
        const { data: inventory } = await supabase
          .from('inventory')
          .select('available_quantity')
          .eq('product_id', product_id)
          .eq('outlet_id', outlet_id)
          .maybeSingle();

        if (inventory && inventory.available_quantity <= product.reorder_level) {
          await supabase.from('notifications').insert({
            user_id: user.id,
            type: 'low_stock',
            title: 'Low Stock Alert',
            message: `${product.name} is running low (${inventory.available_quantity} units)`,
            priority: 'high',
            metadata: {
              product_id,
              current_stock: inventory.available_quantity,
              reorder_level: product.reorder_level,
            },
          });
        }
      }
    }

    console.log('Scan processed successfully:', scan.id);

    return new Response(
      JSON.stringify({
        success: true,
        scan,
        product,
        processing_status,
        processing_notes,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('Error processing scan:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    );
  }
});
