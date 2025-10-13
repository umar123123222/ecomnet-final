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
    console.log('Order Fulfillment Operation:', action, data);

    switch (action) {
      case 'dispatch': {
        // Validate required fields
        if (!data.order_id || !data.outlet_id) {
          throw new Error('Missing required fields: order_id and outlet_id');
        }

        // Get order details
        const { data: order, error: orderError } = await supabaseClient
          .from('orders')
          .select('*, order_items(*)')
          .eq('id', data.order_id)
          .single();

        if (orderError) throw orderError;

        // Check if order can be dispatched
        if (order.status === 'dispatched' || order.status === 'delivered') {
          throw new Error('Order already dispatched or delivered');
        }

        // Verify stock availability and deduct
        const insufficientStock: string[] = [];
        
        for (const item of order.order_items) {
          // Try to find product by name match
          const { data: product } = await supabaseClient
            .from('products')
            .select('id')
            .ilike('name', `%${item.item_name}%`)
            .single();

          if (!product) {
            console.log(`Product not found in inventory: ${item.item_name}`);
            continue;
          }

          // Check inventory
          const { data: inventory, error: invError } = await supabaseClient
            .from('inventory')
            .select('id, quantity, reserved_quantity, available_quantity')
            .eq('product_id', product.id)
            .eq('outlet_id', data.outlet_id)
            .single();

          if (invError || !inventory) {
            insufficientStock.push(item.item_name);
            continue;
          }

          // Check if sufficient stock
          const requiredQty = item.quantity;
          if (inventory.available_quantity < requiredQty) {
            insufficientStock.push(`${item.item_name} (need: ${requiredQty}, available: ${inventory.available_quantity})`);
            continue;
          }

          // Deduct from inventory
          await supabaseClient
            .from('inventory')
            .update({
              quantity: inventory.quantity - requiredQty,
              reserved_quantity: Math.max(0, inventory.reserved_quantity - requiredQty),
              available_quantity: inventory.quantity - requiredQty - Math.max(0, inventory.reserved_quantity - requiredQty)
            })
            .eq('id', inventory.id);

          // Create stock movement record
          await supabaseClient
            .from('stock_movements')
            .insert({
              product_id: product.id,
              outlet_id: data.outlet_id,
              movement_type: 'sale',
              quantity: -requiredQty,
              created_by: user.id,
              reference_id: order.id,
              notes: `Order dispatch: ${order.order_number}`
            });
        }

        // If there's insufficient stock, throw error
        if (insufficientStock.length > 0) {
          throw new Error(`Insufficient stock for: ${insufficientStock.join(', ')}`);
        }

        // Update order status to dispatched
        await supabaseClient
          .from('orders')
          .update({
            status: 'dispatched',
            dispatched_at: new Date().toISOString()
          })
          .eq('id', data.order_id);

        return new Response(
          JSON.stringify({ 
            success: true, 
            message: 'Order dispatched and inventory updated successfully'
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'cancel': {
        // Release reserved stock when order is cancelled
        if (!data.order_id || !data.outlet_id) {
          throw new Error('Missing required fields: order_id and outlet_id');
        }

        const { data: order, error: orderError } = await supabaseClient
          .from('orders')
          .select('*, order_items(*)')
          .eq('id', data.order_id)
          .single();

        if (orderError) throw orderError;

        // Release reservations
        for (const item of order.order_items) {
          const { data: product } = await supabaseClient
            .from('products')
            .select('id')
            .ilike('name', `%${item.item_name}%`)
            .single();

          if (!product) continue;

          const { data: inventory } = await supabaseClient
            .from('inventory')
            .select('id, quantity, reserved_quantity')
            .eq('product_id', product.id)
            .eq('outlet_id', data.outlet_id)
            .single();

          if (!inventory) continue;

          // Release reservation
          const releaseQty = Math.min(item.quantity, inventory.reserved_quantity);
          await supabaseClient
            .from('inventory')
            .update({
              reserved_quantity: inventory.reserved_quantity - releaseQty,
              available_quantity: (inventory.quantity - inventory.reserved_quantity) + releaseQty
            })
            .eq('id', inventory.id);
        }

        // Update order status
        await supabaseClient
          .from('orders')
          .update({ status: 'cancelled' })
          .eq('id', data.order_id);

        return new Response(
          JSON.stringify({ 
            success: true, 
            message: 'Order cancelled and stock reservation released'
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
