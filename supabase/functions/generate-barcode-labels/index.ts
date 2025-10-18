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
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    const authHeader = req.headers.get('Authorization')!;
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { label_type, product_id, packaging_item_id, production_batch_id, quantity, label_data } = await req.json();

    // Validate required fields
    if (!label_type || !quantity || !label_data) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Log the print request
    const { error: logError } = await supabase.from('label_print_logs').insert({
      label_type,
      product_id,
      packaging_item_id,
      production_batch_id,
      quantity_printed: quantity,
      label_data,
      printed_by: user.id,
      print_format: 'HTML',
    });

    if (logError) {
      console.error('Failed to log label print:', logError);
    }

    // Log activity
    await supabase.from('activity_logs').insert({
      user_id: user.id,
      action: 'print_labels',
      entity_type: 'label_print_logs',
      entity_id: product_id || packaging_item_id || production_batch_id || '',
      details: {
        label_type,
        quantity,
        product_name: label_data.productName,
      },
    });

    // Return label data for client-side rendering
    return new Response(
      JSON.stringify({ 
        success: true, 
        label_data,
        quantity 
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
