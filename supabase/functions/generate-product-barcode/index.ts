import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseServiceRoleKey) {
      throw new Error('Missing Supabase environment variables');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { product_id, barcode_type, barcode_format = 'CODE128', metadata = {} } = await req.json();

    // Validate required fields
    if (!product_id || !barcode_type) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: product_id, barcode_type' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate barcode type
    const validTypes = ['raw', 'finished', 'distribution'];
    if (!validTypes.includes(barcode_type)) {
      return new Response(
        JSON.stringify({ error: `Invalid barcode_type. Must be one of: ${validTypes.join(', ')}` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if product exists
    const { data: product, error: productError } = await supabase
      .from('products')
      .select('id, name, sku')
      .eq('id', product_id)
      .single();

    if (productError || !product) {
      return new Response(
        JSON.stringify({ error: 'Product not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if barcode already exists for this type
    const { data: existingBarcode } = await supabase
      .from('product_barcodes')
      .select('*')
      .eq('product_id', product_id)
      .eq('barcode_type', barcode_type)
      .eq('status', 'active')
      .single();

    if (existingBarcode) {
      return new Response(
        JSON.stringify({ 
          error: `Active ${barcode_type} barcode already exists for this product`,
          existing_barcode: existingBarcode 
        }),
        { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Generate unique barcode value
    const prefix = barcode_type === 'raw' ? 'RAW' : barcode_type === 'finished' ? 'FIN' : 'DIST';
    const timestamp = Date.now().toString().slice(-8);
    const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    const barcode_value = `${prefix}-${product.sku}-${timestamp}${random}`;

    // Insert barcode
    const { data: newBarcode, error: insertError } = await supabase
      .from('product_barcodes')
      .insert({
        product_id,
        barcode_type,
        barcode_value,
        barcode_format,
        status: 'active',
        generated_by: user.id,
        metadata,
      })
      .select('*')
      .single();

    if (insertError) {
      console.error('Failed to insert barcode:', insertError);
      return new Response(
        JSON.stringify({ error: 'Failed to generate barcode', details: insertError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Log activity
    await supabase.from('activity_logs').insert({
      user_id: user.id,
      action: 'generate_barcode',
      entity_type: 'product_barcodes',
      entity_id: newBarcode.id,
      details: {
        product_id,
        product_name: product.name,
        barcode_type,
        barcode_value,
      },
    });

    console.log(`Generated ${barcode_type} barcode for product ${product.name}: ${barcode_value}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        barcode: newBarcode,
        product: {
          id: product.id,
          name: product.name,
          sku: product.sku,
        }
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
