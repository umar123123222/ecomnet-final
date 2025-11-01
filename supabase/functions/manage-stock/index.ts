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
        
        console.log(`[adjustStock] Starting adjustment - Product: ${productId}, Outlet: ${outletId}, Adjustment: ${quantity}`)
        
        // Fetch current inventory quantity
        const { data: currentInventory, error: fetchError } = await supabaseClient
          .from('inventory')
          .select('quantity, reserved_quantity')
          .eq('product_id', productId)
          .eq('outlet_id', outletId)
          .single()

        if (fetchError) {
          console.error('[adjustStock] Error fetching inventory:', fetchError)
          throw fetchError
        }

        if (!currentInventory) {
          throw new Error('Inventory record not found for this product and outlet')
        }

        // Calculate new quantity (current + adjustment)
        const newQuantity = currentInventory.quantity + quantity
        
        console.log(`[adjustStock] Current: ${currentInventory.quantity}, Adjustment: ${quantity}, New: ${newQuantity}`)

        // Validate: prevent negative stock
        if (newQuantity < 0) {
          const error = `Cannot adjust stock: would result in negative quantity (${newQuantity}). Current stock: ${currentInventory.quantity}, Adjustment: ${quantity}`
          console.error(`[adjustStock] ${error}`)
          return new Response(
            JSON.stringify({ error }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }

        // Update inventory with new quantity
        const { error: updateError } = await supabaseClient
          .from('inventory')
          .update({ 
            quantity: newQuantity,
            last_restocked_at: new Date().toISOString()
          })
          .eq('product_id', productId)
          .eq('outlet_id', outletId)

        if (updateError) {
          console.error('[adjustStock] Error updating inventory:', updateError)
          throw updateError
        }

        // Create stock movement record with correct field (outlet_id, not to_outlet_id)
        const { error: movementError } = await supabaseClient
          .from('stock_movements')
          .insert({
            product_id: productId,
            outlet_id: outletId,
            quantity: Math.abs(quantity), // Store absolute value
            movement_type: 'adjustment',
            notes: reason,
            performed_by: user.id,
          })

        if (movementError) {
          console.error('[adjustStock] Error creating stock movement:', movementError)
          throw movementError
        }

        console.log(`[adjustStock] Success - Stock adjusted from ${currentInventory.quantity} to ${newQuantity}`)

        return new Response(
          JSON.stringify({ 
            success: true, 
            previousQuantity: currentInventory.quantity,
            newQuantity: newQuantity,
            adjustment: quantity
          }),
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

      case 'adjustPackagingStock': {
        const { packagingItemId, quantity, reason } = data
        
        console.log(`[adjustPackagingStock] Starting adjustment - Packaging: ${packagingItemId}, Adjustment: ${quantity}`)
        
        // Fetch current packaging stock
        const { data: currentPackaging, error: fetchError } = await supabaseClient
          .from('packaging_items')
          .select('current_stock, name, sku')
          .eq('id', packagingItemId)
          .single()

        if (fetchError) {
          console.error('[adjustPackagingStock] Error fetching packaging item:', fetchError)
          throw fetchError
        }

        if (!currentPackaging) {
          throw new Error('Packaging item not found')
        }

        // Calculate new quantity (current + adjustment)
        const newQuantity = currentPackaging.current_stock + quantity
        
        console.log(`[adjustPackagingStock] Current: ${currentPackaging.current_stock}, Adjustment: ${quantity}, New: ${newQuantity}`)

        // Validate: prevent negative stock
        if (newQuantity < 0) {
          const error = `Cannot adjust packaging stock: would result in negative quantity (${newQuantity}). Current stock: ${currentPackaging.current_stock}, Adjustment: ${quantity}`
          console.error(`[adjustPackagingStock] ${error}`)
          return new Response(
            JSON.stringify({ error }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }

        // Update packaging item stock
        const { error: updateError } = await supabaseClient
          .from('packaging_items')
          .update({ 
            current_stock: newQuantity,
            updated_at: new Date().toISOString()
          })
          .eq('id', packagingItemId)

        if (updateError) {
          console.error('[adjustPackagingStock] Error updating packaging stock:', updateError)
          throw updateError
        }

        // Log the adjustment in activity_logs
        const { error: logError } = await supabaseClient
          .from('activity_logs')
          .insert({
            user_id: user.id,
            entity_type: 'packaging_items',
            entity_id: packagingItemId,
            action: 'stock_adjustment',
            details: {
              previous_stock: currentPackaging.current_stock,
              new_stock: newQuantity,
              adjustment: quantity,
              reason: reason,
              packaging_name: currentPackaging.name,
              packaging_sku: currentPackaging.sku
            }
          })

        if (logError) {
          console.error('[adjustPackagingStock] Error logging adjustment:', logError)
          // Don't throw - this is not critical
        }

        console.log(`[adjustPackagingStock] Success - Stock adjusted from ${currentPackaging.current_stock} to ${newQuantity}`)

        return new Response(
          JSON.stringify({ 
            success: true, 
            previousQuantity: currentPackaging.current_stock,
            newQuantity: newQuantity,
            adjustment: quantity
          }),
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