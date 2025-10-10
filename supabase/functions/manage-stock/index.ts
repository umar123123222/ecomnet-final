import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
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
    )

    // Verify user is authenticated
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser()
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const { operation, data } = await req.json()

    switch (operation) {
      case 'checkAvailability': {
        const { productId, outletId, quantity } = data
        
        const { data: inventory, error } = await supabaseClient
          .from('inventory')
          .select('available_quantity')
          .eq('product_id', productId)
          .eq('outlet_id', outletId)
          .single()

        if (error) throw error

        return new Response(
          JSON.stringify({ 
            available: inventory.available_quantity >= quantity,
            availableQuantity: inventory.available_quantity 
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      case 'reserveStock': {
        const { productId, outletId, quantity, orderId } = data
        
        // Check availability first
        const { data: inventory, error: checkError } = await supabaseClient
          .from('inventory')
          .select('available_quantity')
          .eq('product_id', productId)
          .eq('outlet_id', outletId)
          .single()

        if (checkError) throw checkError

        if (inventory.available_quantity < quantity) {
          return new Response(
            JSON.stringify({ error: 'Insufficient stock available' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }

        // Reserve the stock
        const { error: updateError } = await supabaseClient
          .from('inventory')
          .update({ reserved_quantity: inventory.reserved_quantity + quantity })
          .eq('product_id', productId)
          .eq('outlet_id', outletId)

        if (updateError) throw updateError

        return new Response(
          JSON.stringify({ success: true }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      case 'releaseStock': {
        const { productId, outletId, quantity } = data
        
        const { data: inventory, error: getError } = await supabaseClient
          .from('inventory')
          .select('reserved_quantity')
          .eq('product_id', productId)
          .eq('outlet_id', outletId)
          .single()

        if (getError) throw getError

        const { error: updateError } = await supabaseClient
          .from('inventory')
          .update({ reserved_quantity: Math.max(0, inventory.reserved_quantity - quantity) })
          .eq('product_id', productId)
          .eq('outlet_id', outletId)

        if (updateError) throw updateError

        return new Response(
          JSON.stringify({ success: true }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      case 'recordSale': {
        const { productId, outletId, quantity, orderId } = data
        
        // Update inventory (reduce quantity and reserved)
        const { data: inventory, error: getError } = await supabaseClient
          .from('inventory')
          .select('quantity, reserved_quantity')
          .eq('product_id', productId)
          .eq('outlet_id', outletId)
          .single()

        if (getError) throw getError

        const { error: updateError } = await supabaseClient
          .from('inventory')
          .update({ 
            quantity: Math.max(0, inventory.quantity - quantity),
            reserved_quantity: Math.max(0, inventory.reserved_quantity - quantity)
          })
          .eq('product_id', productId)
          .eq('outlet_id', outletId)

        if (updateError) throw updateError

        // Create stock movement record
        const { error: movementError } = await supabaseClient
          .from('stock_movements')
          .insert({
            product_id: productId,
            from_outlet_id: outletId,
            quantity: quantity,
            movement_type: 'sale',
            reference_id: orderId,
            performed_by: user.id,
          })

        if (movementError) throw movementError

        return new Response(
          JSON.stringify({ success: true }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      case 'processReturn': {
        const { productId, outletId, quantity, returnId } = data
        
        // Add stock back to inventory
        const { error: updateError } = await supabaseClient
          .from('inventory')
          .update({ quantity: supabaseClient.rpc('increment', { x: quantity }) })
          .eq('product_id', productId)
          .eq('outlet_id', outletId)

        if (updateError) throw updateError

        // Create stock movement record
        const { error: movementError } = await supabaseClient
          .from('stock_movements')
          .insert({
            product_id: productId,
            to_outlet_id: outletId,
            quantity: quantity,
            movement_type: 'return',
            reference_id: returnId,
            performed_by: user.id,
          })

        if (movementError) throw movementError

        return new Response(
          JSON.stringify({ success: true }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      case 'adjustStock': {
        const { productId, outletId, quantity, reason } = data
        
        const { error: updateError } = await supabaseClient
          .from('inventory')
          .update({ 
            quantity: quantity,
            last_restocked_at: new Date().toISOString()
          })
          .eq('product_id', productId)
          .eq('outlet_id', outletId)

        if (updateError) throw updateError

        // Create stock movement record
        const { error: movementError } = await supabaseClient
          .from('stock_movements')
          .insert({
            product_id: productId,
            to_outlet_id: outletId,
            quantity: quantity,
            movement_type: 'adjustment',
            notes: reason,
            performed_by: user.id,
          })

        if (movementError) throw movementError

        return new Response(
          JSON.stringify({ success: true }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      case 'transferStock': {
        const { productId, fromOutletId, toOutletId, quantity, notes } = data
        
        // Reduce from source outlet
        const { error: reduceError } = await supabaseClient
          .from('inventory')
          .update({ quantity: supabaseClient.rpc('decrement', { x: quantity }) })
          .eq('product_id', productId)
          .eq('outlet_id', fromOutletId)

        if (reduceError) throw reduceError

        // Add to destination outlet
        const { error: addError } = await supabaseClient
          .from('inventory')
          .update({ quantity: supabaseClient.rpc('increment', { x: quantity }) })
          .eq('product_id', productId)
          .eq('outlet_id', toOutletId)

        if (addError) throw addError

        // Create stock movement record
        const { error: movementError } = await supabaseClient
          .from('stock_movements')
          .insert({
            product_id: productId,
            from_outlet_id: fromOutletId,
            to_outlet_id: toOutletId,
            quantity: quantity,
            movement_type: 'transfer',
            notes: notes,
            performed_by: user.id,
          })

        if (movementError) throw movementError

        return new Response(
          JSON.stringify({ success: true }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      default:
        return new Response(
          JSON.stringify({ error: 'Invalid operation' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
    }
  } catch (error) {
    console.error('Stock operation error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})