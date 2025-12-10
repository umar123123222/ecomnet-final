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
        
        console.log(`[reserveStock] Reserving ${quantity} units for product ${productId} at outlet ${outletId}`)
        
        // Get current inventory with reserved_quantity
        const { data: inventory, error: checkError } = await supabaseClient
          .from('inventory')
          .select('quantity, reserved_quantity, available_quantity')
          .eq('product_id', productId)
          .eq('outlet_id', outletId)
          .single()

        if (checkError) throw checkError

        if (inventory.available_quantity < quantity) {
          console.error(`[reserveStock] Insufficient stock: need ${quantity}, available ${inventory.available_quantity}`)
          return new Response(
            JSON.stringify({ error: 'Insufficient stock available' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }

        // Reserve the stock (available_quantity auto-calculated by DB trigger)
        const newReservedQty = inventory.reserved_quantity + quantity
        const { error: updateError } = await supabaseClient
          .from('inventory')
          .update({ reserved_quantity: newReservedQty })
          .eq('product_id', productId)
          .eq('outlet_id', outletId)

        if (updateError) throw updateError

        console.log(`[reserveStock] Success: reserved_quantity ${inventory.reserved_quantity} -> ${newReservedQty}`)

        // Create stock movement record for audit trail
        await supabaseClient
          .from('stock_movements')
          .insert({
            product_id: productId,
            outlet_id: outletId,
            quantity: 0, // No physical movement, just reservation
            movement_type: 'adjustment',
            notes: `Stock reserved for order: ${orderId || 'N/A'} (+${quantity} reserved)`,
            created_by: user.id,
            reference_id: orderId
          })

        return new Response(
          JSON.stringify({ success: true }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      case 'releaseStock': {
        const { productId, outletId, quantity, orderId } = data
        
        console.log(`[releaseStock] Releasing ${quantity} reserved units for product ${productId} at outlet ${outletId}`)
        
        const { data: inventory, error: getError } = await supabaseClient
          .from('inventory')
          .select('reserved_quantity')
          .eq('product_id', productId)
          .eq('outlet_id', outletId)
          .single()

        if (getError) throw getError

        const newReservedQty = Math.max(0, inventory.reserved_quantity - quantity)
        const { error: updateError } = await supabaseClient
          .from('inventory')
          .update({ reserved_quantity: newReservedQty })
          .eq('product_id', productId)
          .eq('outlet_id', outletId)

        if (updateError) throw updateError

        console.log(`[releaseStock] Success: reserved_quantity ${inventory.reserved_quantity} -> ${newReservedQty}`)

        // Create stock movement record for audit trail
        await supabaseClient
          .from('stock_movements')
          .insert({
            product_id: productId,
            outlet_id: outletId,
            quantity: 0, // No physical movement, just reservation release
            movement_type: 'adjustment',
            notes: `Stock reservation released for order: ${orderId || 'N/A'} (-${quantity} reserved)`,
            created_by: user.id,
            reference_id: orderId
          })

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
            outlet_id: outletId,
            quantity: quantity,
            movement_type: 'sale',
            reference_id: orderId,
            created_by: user.id,
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
            outlet_id: outletId,
            quantity: quantity,
            movement_type: 'return',
            reference_id: returnId,
            created_by: user.id,
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
        
        // ========== SERVER-SIDE OUTLET VALIDATION ==========
        // Get user's role from user_roles table
        const { data: userRoleData, error: roleError } = await supabaseClient
          .from('user_roles')
          .select('role')
          .eq('user_id', user.id)
          .eq('is_active', true)
          .single()
        
        const userRole = userRoleData?.role
        console.log(`[adjustStock] User ${user.id} has role: ${userRole}`)
        
        // For warehouse_manager and store_manager, validate outlet assignment
        if (userRole === 'warehouse_manager' || userRole === 'store_manager') {
          // Check if user is manager of this outlet
          const { data: managedOutlet } = await supabaseClient
            .from('outlets')
            .select('id')
            .eq('manager_id', user.id)
            .eq('id', outletId)
            .single()
          
          // Check if user is staff at this outlet
          const { data: staffOutlet } = await supabaseClient
            .from('outlet_staff')
            .select('outlet_id')
            .eq('user_id', user.id)
            .eq('outlet_id', outletId)
            .single()
          
          if (!managedOutlet && !staffOutlet) {
            console.error(`[adjustStock] Access denied: User ${user.id} (${userRole}) is not assigned to outlet ${outletId}`)
            return new Response(
              JSON.stringify({ error: 'You can only adjust stock for your assigned outlet' }),
              { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
          }
          console.log(`[adjustStock] Outlet access validated for ${userRole}`)
        }
        // ========== END OUTLET VALIDATION ==========
        
        // Fetch current inventory quantity
        const { data: currentInventory, error: fetchError } = await supabaseClient
          .from('inventory')
          .select('quantity, reserved_quantity')
          .eq('product_id', productId)
          .eq('outlet_id', outletId)
          .maybeSingle()

        // If no inventory record exists, create one with 0 quantity
        let inventoryRecord = currentInventory
        if (!inventoryRecord) {
          console.log(`[adjustStock] No inventory record found, creating new record for product ${productId} at outlet ${outletId}`)
          
          const { data: newInventory, error: insertError } = await supabaseClient
            .from('inventory')
            .insert({
              product_id: productId,
              outlet_id: outletId,
              quantity: 0,
              reserved_quantity: 0
            })
            .select('quantity, reserved_quantity')
            .single()
          
          if (insertError) {
            console.error('[adjustStock] Error creating inventory record:', insertError)
            throw insertError
          }
          
          inventoryRecord = newInventory
          console.log(`[adjustStock] Created new inventory record with quantity 0`)
        }

        if (fetchError && fetchError.code !== 'PGRST116') {
          console.error('[adjustStock] Error fetching inventory:', fetchError)
          throw fetchError
        }

        // Calculate new quantity (current + adjustment)
        const newQuantity = inventoryRecord.quantity + quantity
        
        console.log(`[adjustStock] Current: ${inventoryRecord.quantity}, Adjustment: ${quantity}, New: ${newQuantity}`)

        // Validate: prevent negative stock
        if (newQuantity < 0) {
          const error = `Cannot adjust stock: would result in negative quantity (${newQuantity}). Current stock: ${inventoryRecord.quantity}, Adjustment: ${quantity}`
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
            created_by: user.id,
          })

        if (movementError) {
          console.error('[adjustStock] Error creating stock movement:', movementError)
          throw movementError
        }

        console.log(`[adjustStock] Success - Stock adjusted from ${inventoryRecord.quantity} to ${newQuantity}`)

        return new Response(
          JSON.stringify({ 
            success: true, 
            previousQuantity: inventoryRecord.quantity,
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
            outlet_id: fromOutletId,
            quantity: quantity,
            movement_type: 'transfer',
            notes: notes,
            created_by: user.id,
          })

        if (movementError) throw movementError

        return new Response(
          JSON.stringify({ success: true }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      case 'adjustPackagingStock': {
        const { packagingItemId, quantity, reason, outletId } = data
        
        console.log(`[adjustPackagingStock] Starting adjustment - Packaging: ${packagingItemId}, Outlet: ${outletId || 'central'}, Adjustment: ${quantity}`)
        
        // Check if this is an outlet-level adjustment (store manager damage reporting)
        if (outletId) {
          // Validate outlet assignment for store managers
          const { data: userRoleData } = await supabaseClient
            .from('user_roles')
            .select('role')
            .eq('user_id', user.id)
            .eq('is_active', true)
            .single()
          
          const userRole = userRoleData?.role
          
          if (userRole === 'store_manager') {
            // Verify store manager is assigned to this outlet
            const { data: managedOutlet } = await supabaseClient
              .from('outlets')
              .select('id')
              .eq('manager_id', user.id)
              .eq('id', outletId)
              .single()
            
            const { data: staffOutlet } = await supabaseClient
              .from('outlet_staff')
              .select('outlet_id')
              .eq('user_id', user.id)
              .eq('outlet_id', outletId)
              .single()
            
            if (!managedOutlet && !staffOutlet) {
              console.error(`[adjustPackagingStock] Access denied: User ${user.id} (${userRole}) is not assigned to outlet ${outletId}`)
              return new Response(
                JSON.stringify({ error: 'You can only adjust packaging for your assigned outlet' }),
                { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
              )
            }
          }
          
          // Fetch current outlet packaging inventory
          const { data: outletInventory, error: fetchError } = await supabaseClient
            .from('outlet_packaging_inventory')
            .select('id, quantity')
            .eq('packaging_item_id', packagingItemId)
            .eq('outlet_id', outletId)
            .maybeSingle()
          
          const currentStock = outletInventory?.quantity || 0
          const newQuantity = currentStock + quantity
          
          console.log(`[adjustPackagingStock] Outlet ${outletId} - Current: ${currentStock}, Adjustment: ${quantity}, New: ${newQuantity}`)
          
          // Validate: prevent negative stock
          if (newQuantity < 0) {
            const error = `Cannot adjust packaging stock: would result in negative quantity (${newQuantity}). Current stock: ${currentStock}, Adjustment: ${quantity}`
            console.error(`[adjustPackagingStock] ${error}`)
            return new Response(
              JSON.stringify({ error }),
              { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
          }
          
          // Use upsert function to update outlet packaging inventory
          const { error: upsertError } = await supabaseClient.rpc('upsert_outlet_packaging_inventory', {
            p_outlet_id: outletId,
            p_packaging_item_id: packagingItemId,
            p_quantity_change: quantity
          })
          
          if (upsertError) {
            console.error('[adjustPackagingStock] Error upserting outlet packaging inventory:', upsertError)
            throw upsertError
          }
          
          // Create packaging movement record for audit trail
          const { error: movementError } = await supabaseClient
            .from('packaging_movements')
            .insert({
              packaging_item_id: packagingItemId,
              movement_type: 'adjustment',
              quantity: quantity,
              notes: `${reason} (Outlet: ${outletId})`,
              created_by: user.id
            })
          
          if (movementError) {
            console.error('[adjustPackagingStock] Error creating packaging movement:', movementError)
          }
          
          console.log(`[adjustPackagingStock] Success - Outlet packaging adjusted from ${currentStock} to ${newQuantity}`)
          
          return new Response(
            JSON.stringify({ 
              success: true, 
              previousQuantity: currentStock,
              newQuantity: newQuantity,
              adjustment: quantity,
              outlet_level: true
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }
        
        // Central warehouse packaging adjustment (original logic)
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
        
        console.log(`[adjustPackagingStock] Central - Current: ${currentPackaging.current_stock}, Adjustment: ${quantity}, New: ${newQuantity}`)

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

        // Create packaging stock movement record for audit trail
        const { error: movementError } = await supabaseClient
          .from('packaging_stock_movements')
          .insert({
            packaging_item_id: packagingItemId,
            movement_type: 'adjustment',
            quantity: quantity,
            previous_stock: currentPackaging.current_stock,
            new_stock: newQuantity,
            notes: reason,
            performed_by: user.id
          })

        if (movementError) {
          console.error('[adjustPackagingStock] Error creating movement record:', movementError)
          // Don't throw - stock update succeeded, movement record is for audit
        }

        // Also log in activity_logs for centralized audit trail
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
          console.error('[adjustPackagingStock] Error logging to activity_logs:', logError)
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

      case 'checkBundleAvailability': {
        const { productId, outletId, quantity } = data
        
        console.log(`[checkBundleAvailability] Checking bundle: ${productId} at outlet: ${outletId}`)
        
        // First check if product is a bundle
        const { data: product, error: productError } = await supabaseClient
          .from('products')
          .select('is_bundle, name')
          .eq('id', productId)
          .single()

        if (productError) throw productError

        if (!product?.is_bundle) {
          // Not a bundle - use regular availability check
          const { data: inventory, error: invError } = await supabaseClient
            .from('inventory')
            .select('available_quantity')
            .eq('product_id', productId)
            .eq('outlet_id', outletId)
            .single()

          if (invError) throw invError

          return new Response(
            JSON.stringify({ 
              available: (inventory?.available_quantity || 0) >= quantity,
              availableQuantity: inventory?.available_quantity || 0,
              isBundle: false
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }

        // Fetch bundle components
        const { data: bundleItems, error: bundleError } = await supabaseClient
          .from('product_bundle_items')
          .select(`
            component_product_id,
            quantity,
            component:products(name, sku)
          `)
          .eq('bundle_product_id', productId)

        if (bundleError) throw bundleError

        if (!bundleItems || bundleItems.length === 0) {
          throw new Error('Bundle has no components defined')
        }

        // Check each component's availability
        let minBundlesAvailable = Infinity
        const componentStatus = []

        for (const item of bundleItems) {
          const { data: inv, error: invError } = await supabaseClient
            .from('inventory')
            .select('available_quantity')
            .eq('product_id', item.component_product_id)
            .eq('outlet_id', outletId)
            .single()

          if (invError) {
            console.error(`Error fetching inventory for component ${item.component_product_id}:`, invError)
            // Component not found in outlet - treat as 0 stock
            componentStatus.push({
              component_id: item.component_product_id,
              component_name: item.component?.name,
              component_sku: item.component?.sku,
              required_per_bundle: item.quantity,
              available: 0,
              bundles_possible: 0,
              is_limiting: true
            })
            minBundlesAvailable = 0
            continue
          }

          const availableQty = inv?.available_quantity || 0
          const bundlesPossible = Math.floor(availableQty / item.quantity)
          minBundlesAvailable = Math.min(minBundlesAvailable, bundlesPossible)

          componentStatus.push({
            component_id: item.component_product_id,
            component_name: item.component?.name,
            component_sku: item.component?.sku,
            required_per_bundle: item.quantity,
            available: availableQty,
            bundles_possible: bundlesPossible,
            is_limiting: false // Will update after loop
          })
        }

        // Mark limiting components
        componentStatus.forEach(comp => {
          comp.is_limiting = comp.bundles_possible === minBundlesAvailable
        })

        console.log(`[checkBundleAvailability] Bundle "${product.name}" can make ${minBundlesAvailable} bundles`)

        return new Response(
          JSON.stringify({
            available: minBundlesAvailable >= quantity,
            bundleAvailability: minBundlesAvailable,
            componentStatus,
            isBundle: true
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      case 'reserveBundleStock': {
        const { productId, outletId, quantity, orderId } = data
        
        console.log(`[reserveBundleStock] Reserving ${quantity} bundles for product ${productId}`)

        // Fetch bundle components
        const { data: bundleItems, error: bundleError } = await supabaseClient
          .from('product_bundle_items')
          .select('component_product_id, quantity')
          .eq('bundle_product_id', productId)

        if (bundleError) throw bundleError

        // Reserve each component
        for (const item of bundleItems) {
          const reserveQty = item.quantity * quantity

          const { data: inventory, error: getError } = await supabaseClient
            .from('inventory')
            .select('reserved_quantity, available_quantity')
            .eq('product_id', item.component_product_id)
            .eq('outlet_id', outletId)
            .single()

          if (getError) throw getError

          if (inventory.available_quantity < reserveQty) {
            throw new Error(`Insufficient stock for component ${item.component_product_id}`)
          }

          const newReservedQty = inventory.reserved_quantity + reserveQty
          const { error: updateError } = await supabaseClient
            .from('inventory')
            .update({ reserved_quantity: newReservedQty })
            .eq('product_id', item.component_product_id)
            .eq('outlet_id', outletId)

          if (updateError) throw updateError

          // Create stock movement for audit
          await supabaseClient
            .from('stock_movements')
            .insert({
              product_id: item.component_product_id,
              outlet_id: outletId,
              quantity: 0,
              movement_type: 'adjustment',
              notes: `Bundle stock reserved for order: ${orderId || 'N/A'} (+${reserveQty} reserved)`,
              created_by: user.id,
              reference_id: orderId
            })

          console.log(`[reserveBundleStock] Reserved ${reserveQty} units of component ${item.component_product_id}`)
        }

        return new Response(
          JSON.stringify({ success: true }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      case 'releaseBundleStock': {
        const { productId, outletId, quantity, orderId } = data
        
        console.log(`[releaseBundleStock] Releasing ${quantity} bundles for product ${productId}`)

        // Fetch bundle components
        const { data: bundleItems, error: bundleError } = await supabaseClient
          .from('product_bundle_items')
          .select('component_product_id, quantity')
          .eq('bundle_product_id', productId)

        if (bundleError) throw bundleError

        // Release each component
        for (const item of bundleItems) {
          const releaseQty = item.quantity * quantity

          const { data: inventory, error: getError } = await supabaseClient
            .from('inventory')
            .select('reserved_quantity')
            .eq('product_id', item.component_product_id)
            .eq('outlet_id', outletId)
            .single()

          if (getError) throw getError

          const newReservedQty = Math.max(0, inventory.reserved_quantity - releaseQty)
          const { error: updateError } = await supabaseClient
            .from('inventory')
            .update({ reserved_quantity: newReservedQty })
            .eq('product_id', item.component_product_id)
            .eq('outlet_id', outletId)

          if (updateError) throw updateError

          // Create stock movement for audit
          await supabaseClient
            .from('stock_movements')
            .insert({
              product_id: item.component_product_id,
              outlet_id: outletId,
              quantity: 0,
              movement_type: 'adjustment',
              notes: `Bundle reservation released for order: ${orderId || 'N/A'} (-${releaseQty} reserved)`,
              created_by: user.id,
              reference_id: orderId
            })

          console.log(`[releaseBundleStock] Released ${releaseQty} units of component ${item.component_product_id}`)
        }

        return new Response(
          JSON.stringify({ success: true }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      case 'recordBundleSale': {
        const { productId, outletId, quantity, orderId } = data
        
        console.log(`[recordBundleSale] Recording sale of ${quantity} bundles for product ${productId}`)

        // Fetch bundle components
        const { data: bundleItems, error: bundleError } = await supabaseClient
          .from('product_bundle_items')
          .select(`
            component_product_id,
            quantity,
            component:products(name)
          `)
          .eq('bundle_product_id', productId)

        if (bundleError) throw bundleError

        // Deduct each component
        for (const item of bundleItems) {
          const deductQty = item.quantity * quantity

          const { data: inventory, error: getError } = await supabaseClient
            .from('inventory')
            .select('quantity, reserved_quantity')
            .eq('product_id', item.component_product_id)
            .eq('outlet_id', outletId)
            .single()

          if (getError) throw getError

          const { error: updateError } = await supabaseClient
            .from('inventory')
            .update({
              quantity: Math.max(0, inventory.quantity - deductQty),
              reserved_quantity: Math.max(0, inventory.reserved_quantity - deductQty)
            })
            .eq('product_id', item.component_product_id)
            .eq('outlet_id', outletId)

          if (updateError) throw updateError

          // Create stock movement
          const { error: movementError } = await supabaseClient
            .from('stock_movements')
            .insert({
              product_id: item.component_product_id,
              outlet_id: outletId,
              quantity: deductQty,
              movement_type: 'sale',
              reference_id: orderId,
              notes: `Bundle sale (${item.component?.name})`,
              created_by: user.id
            })

          if (movementError) throw movementError

          console.log(`[recordBundleSale] Deducted ${deductQty} units of component ${item.component?.name}`)
        }

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