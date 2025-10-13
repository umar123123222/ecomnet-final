import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
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
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    );

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    if (authError || !user) {
      throw new Error('Unauthorized');
    }

    const { action, data } = await req.json();
    console.log('Return Restock Operation:', action, data);

    switch (action) {
      case 'receive': {
        // Validate required fields
        if (!data.return_id || !data.outlet_id) {
          throw new Error('Missing required fields: return_id and outlet_id');
        }

        // Get return details
        const { data: returnItem, error: returnError } = await supabaseClient
          .from('returns')
          .select('*, orders(id, order_items(*))')
          .eq('id', data.return_id)
          .single();

        if (returnError) throw returnError;

        // Check if already processed
        if (returnItem.return_status === 'received' || returnItem.return_status === 'restocked') {
          throw new Error('Return already processed');
        }

        // Restock each item from the order
        const orderItems = returnItem.orders?.order_items || [];
        
        for (const item of orderItems) {
          // Try to find product by name match
          const { data: product } = await supabaseClient
            .from('products')
            .select('id')
            .ilike('name', `%${item.item_name}%`)
            .single();

          if (!product) {
            console.log(`Product not found for restocking: ${item.item_name}`);
            continue;
          }

          // Get or create inventory record
          const { data: inventory } = await supabaseClient
            .from('inventory')
            .select('id, quantity, reserved_quantity')
            .eq('product_id', product.id)
            .eq('outlet_id', data.outlet_id)
            .single();

          if (inventory) {
            // Update existing inventory
            await supabaseClient
              .from('inventory')
              .update({
                quantity: inventory.quantity + item.quantity,
                available_quantity: (inventory.quantity + item.quantity) - inventory.reserved_quantity
              })
              .eq('id', inventory.id);
          } else {
            // Create new inventory record
            await supabaseClient
              .from('inventory')
              .insert({
                product_id: product.id,
                outlet_id: data.outlet_id,
                quantity: item.quantity,
                available_quantity: item.quantity,
                reserved_quantity: 0
              });
          }

          // Create stock movement record
          await supabaseClient
            .from('stock_movements')
            .insert({
              product_id: product.id,
              outlet_id: data.outlet_id,
              movement_type: 'return',
              quantity: item.quantity,
              created_by: user.id,
              reference_id: returnItem.id,
              notes: `Return restocked: ${returnItem.tracking_id || returnItem.id}`
            });
        }

        // Update return status
        await supabaseClient
          .from('returns')
          .update({
            return_status: 'received',
            received_at: new Date().toISOString(),
            received_by: user.id
          })
          .eq('id', data.return_id);

        return new Response(
          JSON.stringify({ 
            success: true, 
            message: 'Return received and inventory restocked successfully',
            items_restocked: orderItems.length
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      default:
        throw new Error(`Unknown action: ${action}`);
    }
  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
