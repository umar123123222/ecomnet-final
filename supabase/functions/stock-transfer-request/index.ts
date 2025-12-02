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

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser()
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const { action, ...data } = await req.json()
    console.log(`Stock transfer action: ${action}`, data)

    switch (action) {
      case 'create': {
        // Support both old format (single item) and new format (multiple items with packaging)
        const { 
          product_id, quantity_requested, // Old format
          items, packaging_items, // New format
          from_outlet_id, to_outlet_id, notes,
          fromOutletId, toOutletId // Alternative field names
        } = data
        
        const finalFromOutletId = from_outlet_id || fromOutletId
        const finalToOutletId = to_outlet_id || toOutletId
        
        // Check if requesting user has access to destination outlet
        const { data: hasAccess } = await supabaseClient.rpc('has_outlet_access', {
          _user_id: user.id,
          _outlet_id: finalToOutletId
        })

        if (!hasAccess) {
          return new Response(
            JSON.stringify({ error: 'No access to destination outlet' }),
            { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }

        // Create transfer request
        const { data: request, error } = await supabaseClient
          .from('stock_transfer_requests')
          .insert({
            from_outlet_id: finalFromOutletId,
            to_outlet_id: finalToOutletId,
            notes: notes,
            requested_by: user.id,
            status: 'pending'
          })
          .select()
          .single()

        if (error) throw error

        // Handle items - support both old and new format
        const productItems = items || (product_id ? [{ product_id, quantity: quantity_requested }] : [])
        
        if (productItems.length > 0) {
          const transferItems = productItems.map((item: any) => ({
            transfer_id: request.id,
            product_id: item.product_id,
            quantity_requested: item.quantity
          }))

          const { error: itemsError } = await supabaseClient
            .from('stock_transfer_items')
            .insert(transferItems)

          if (itemsError) throw itemsError
        }

        // Handle packaging items if provided
        if (packaging_items && packaging_items.length > 0) {
          const packagingTransferItems = packaging_items.map((item: any) => ({
            transfer_id: request.id,
            packaging_item_id: item.packaging_item_id,
            quantity_requested: item.quantity,
            is_auto_calculated: item.is_auto_calculated || false,
            notes: item.notes
          }))

          const { error: packagingError } = await supabaseClient
            .from('stock_transfer_packaging_items')
            .insert(packagingTransferItems)

          if (packagingError) {
            console.error('Error inserting packaging items:', packagingError)
            // Don't throw - packaging table might not exist yet
          }
        }

        return new Response(
          JSON.stringify({ success: true, request }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      case 'approve': {
        const { transfer_id, quantity_approved, items_approved, packaging_items_approved } = data
        
        const { data: request, error: getError } = await supabaseClient
          .from('stock_transfer_requests')
          .select('*')
          .eq('id', transfer_id)
          .single()

        if (getError) throw getError

        const { data: profile } = await supabaseClient
          .from('profiles')
          .select('role')
          .eq('id', user.id)
          .single()

        const canApprove = profile && ['super_admin', 'super_manager', 'warehouse_manager'].includes(profile.role)
        if (!canApprove) {
          return new Response(
            JSON.stringify({ error: 'Insufficient permissions to approve' }),
            { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }

        const { error: updateError } = await supabaseClient
          .from('stock_transfer_requests')
          .update({
            status: 'approved',
            approved_by: user.id,
            approved_at: new Date().toISOString()
          })
          .eq('id', transfer_id)

        if (updateError) throw updateError

        // Update product items with approved quantities
        if (items_approved && items_approved.length > 0) {
          for (const item of items_approved) {
            await supabaseClient
              .from('stock_transfer_items')
              .update({ quantity_approved: item.quantity_approved })
              .eq('id', item.id)
          }
        } else if (quantity_approved) {
          // Old format - single quantity
          await supabaseClient
            .from('stock_transfer_items')
            .update({ quantity_approved })
            .eq('transfer_id', transfer_id)
        }

        // Update packaging items with approved quantities
        if (packaging_items_approved && packaging_items_approved.length > 0) {
          for (const item of packaging_items_approved) {
            await supabaseClient
              .from('stock_transfer_packaging_items')
              .update({ quantity_approved: item.quantity_approved })
              .eq('id', item.id)
          }
        }

        return new Response(
          JSON.stringify({ success: true, message: 'Transfer request approved' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      case 'reject': {
        const { transfer_id, rejection_reason } = data
        
        const { data: profile } = await supabaseClient
          .from('profiles')
          .select('role')
          .eq('id', user.id)
          .single()

        const canReject = profile && ['super_admin', 'super_manager', 'warehouse_manager'].includes(profile.role)
        if (!canReject) {
          return new Response(
            JSON.stringify({ error: 'Insufficient permissions' }),
            { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }

        const { error } = await supabaseClient
          .from('stock_transfer_requests')
          .update({ 
            status: 'rejected',
            notes: rejection_reason 
          })
          .eq('id', transfer_id)

        if (error) throw error

        return new Response(
          JSON.stringify({ success: true, message: 'Transfer request rejected' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      case 'complete': {
        const { transfer_id } = data
        
        // Get the approved request with items and packaging
        const { data: request, error: getError } = await supabaseClient
          .from('stock_transfer_requests')
          .select(`
            *,
            items:stock_transfer_items(*),
            packaging_items:stock_transfer_packaging_items(*)
          `)
          .eq('id', transfer_id)
          .eq('status', 'approved')
          .single()

        if (getError) throw getError

        if (!request) {
          return new Response(
            JSON.stringify({ error: 'Request not found or not approved' }),
            { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }

        // Process product items
        for (const item of request.items) {
          const quantity = item.quantity_approved || item.quantity_requested

          const { error: movementError } = await supabaseClient
            .from('stock_movements')
            .insert([
              {
                product_id: item.product_id,
                outlet_id: request.from_outlet_id,
                quantity: -quantity,
                movement_type: 'transfer_out',
                reference_id: transfer_id,
                notes: `Transfer to outlet`,
                created_by: user.id,
              },
              {
                product_id: item.product_id,
                outlet_id: request.to_outlet_id,
                quantity: quantity,
                movement_type: 'transfer_in',
                reference_id: transfer_id,
                notes: `Transfer from warehouse`,
                created_by: user.id,
              }
            ])

          if (movementError) throw movementError
        }

        // Process packaging items
        if (request.packaging_items && request.packaging_items.length > 0) {
          for (const packItem of request.packaging_items) {
            const quantity = packItem.quantity_approved || packItem.quantity_requested

            // Create packaging movement (deduct from warehouse)
            const { error: packMovementError } = await supabaseClient
              .from('packaging_movements')
              .insert({
                packaging_item_id: packItem.packaging_item_id,
                movement_type: 'transfer_out',
                quantity: -quantity,
                reference_id: transfer_id,
                notes: `Transfer to outlet`,
                created_by: user.id
              })

            if (packMovementError) {
              console.error('Error creating packaging movement:', packMovementError)
            }

            // Deduct from packaging_items current_stock
            await supabaseClient.rpc('decrement_packaging_stock', {
              p_packaging_item_id: packItem.packaging_item_id,
              p_quantity: quantity
            }).catch(() => {
              // If RPC doesn't exist, do direct update
              supabaseClient
                .from('packaging_items')
                .update({ current_stock: supabaseClient.raw(`current_stock - ${quantity}`) })
                .eq('id', packItem.packaging_item_id)
            })
          }
        }

        const { error: completeError } = await supabaseClient
          .from('stock_transfer_requests')
          .update({
            status: 'completed',
            completed_at: new Date().toISOString()
          })
          .eq('id', transfer_id)

        if (completeError) throw completeError

        return new Response(
          JSON.stringify({ success: true, message: 'Transfer completed successfully' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      case 'receive': {
        const { transfer_id, receipt_items, packaging_receipt_items, notes } = data
        
        const { data: transfer, error: transferError } = await supabaseClient
          .from('stock_transfer_requests')
          .select(`
            *,
            to_outlet:outlets!stock_transfer_requests_to_outlet_id_fkey(id, name),
            from_outlet:outlets!stock_transfer_requests_from_outlet_id_fkey(id, name),
            items:stock_transfer_items(
              id,
              product_id,
              quantity_approved,
              quantity_requested,
              product:products(id, name, sku, cost)
            ),
            packaging_items:stock_transfer_packaging_items(
              id,
              packaging_item_id,
              quantity_approved,
              quantity_requested,
              packaging:packaging_items(id, name, sku, cost_per_unit)
            )
          `)
          .eq('id', transfer_id)
          .single()

        if (transferError) throw transferError

        const { data: hasAccess } = await supabaseClient.rpc('has_outlet_access', {
          _user_id: user.id,
          _outlet_id: transfer.to_outlet_id
        })

        if (!hasAccess) {
          return new Response(
            JSON.stringify({ error: 'No access to receiving outlet' }),
            { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }

        const { data: receipt, error: receiptError } = await supabaseClient
          .from('transfer_receipts')
          .insert({
            transfer_id: transfer_id,
            received_by: user.id,
            received_at: new Date().toISOString(),
            notes: notes
          })
          .select()
          .single()

        if (receiptError) throw receiptError

        const variances: any[] = []

        // Process product receipt items
        for (const item of (receipt_items || [])) {
          const transferItem = transfer.items.find((ti: any) => ti.id === item.transfer_item_id)
          if (!transferItem) continue

          const { error: itemError } = await supabaseClient
            .from('transfer_receipt_items')
            .insert({
              receipt_id: receipt.id,
              transfer_item_id: item.transfer_item_id,
              quantity_expected: item.quantity_expected,
              quantity_received: item.quantity_received,
              variance_reason: item.variance_reason
            })

          if (itemError) throw itemError

          const variance = item.quantity_expected - item.quantity_received
          if (variance !== 0) {
            const varianceValue = variance * (transferItem.product?.cost || 0)
            const severity = Math.abs(varianceValue) > 10000 ? 'critical' :
                           Math.abs(varianceValue) > 5000 ? 'high' :
                           Math.abs(varianceValue) > 1000 ? 'medium' : 'low'

            const { data: varianceRecord, error: varianceError } = await supabaseClient
              .from('transfer_variances')
              .insert({
                transfer_id: transfer_id,
                transfer_item_id: item.transfer_item_id,
                product_id: transferItem.product_id,
                outlet_id: transfer.to_outlet_id,
                expected_quantity: item.quantity_expected,
                received_quantity: item.quantity_received,
                variance: variance,
                variance_value: varianceValue,
                severity: severity,
                reported_by: user.id,
                status: 'open'
              })
              .select('*, product:products(name, sku)')
              .single()

            if (varianceError) throw varianceError
            variances.push(varianceRecord)
          }

          const { error: movementError } = await supabaseClient
            .from('stock_movements')
            .insert({
              product_id: transferItem.product_id,
              outlet_id: transfer.to_outlet_id,
              quantity: item.quantity_received,
              movement_type: 'transfer_in',
              reference_id: transfer_id,
              notes: `Transfer receipt from ${transfer.from_outlet?.name || 'warehouse'}${variance !== 0 ? ` (Variance: ${variance})` : ''}`,
              created_by: user.id,
            })

          if (movementError) throw movementError
        }

        // Process packaging receipt items
        for (const item of (packaging_receipt_items || [])) {
          const packagingItem = transfer.packaging_items?.find((pi: any) => pi.id === item.transfer_packaging_item_id)
          if (!packagingItem) continue

          // Update received quantity
          await supabaseClient
            .from('stock_transfer_packaging_items')
            .update({ quantity_received: item.quantity_received })
            .eq('id', item.transfer_packaging_item_id)

          // Create packaging movement for received quantity
          const { error: packMovementError } = await supabaseClient
            .from('packaging_movements')
            .insert({
              packaging_item_id: packagingItem.packaging_item_id,
              movement_type: 'transfer_in',
              quantity: item.quantity_received,
              reference_id: transfer_id,
              notes: `Transfer receipt from ${transfer.from_outlet?.name || 'warehouse'}`,
              created_by: user.id
            })

          if (packMovementError) {
            console.error('Error creating packaging receipt movement:', packMovementError)
          }
        }

        const status = variances.length > 0 ? 'received' : 'completed'
        const { error: updateError } = await supabaseClient
          .from('stock_transfer_requests')
          .update({ 
            status: status,
            completed_at: new Date().toISOString()
          })
          .eq('id', transfer_id)

        if (updateError) throw updateError

        // Send notifications if variances detected
        if (variances.length > 0) {
          const { data: managersToNotify } = await supabaseClient
            .from('profiles')
            .select('id, email, full_name')
            .in('role', ['super_admin', 'super_manager', 'warehouse_manager'])

          if (managersToNotify) {
            const notifications = managersToNotify.map((manager: any) => ({
              user_id: manager.id,
              title: 'Transfer Variance Detected',
              message: `Transfer to ${transfer.to_outlet?.name} has variances. ${variances.length} item(s) with discrepancies detected.`,
              type: 'warning',
              priority: 'high',
              action_url: `/stock-transfer`,
              metadata: {
                transfer_id: transfer_id,
                outlet_name: transfer.to_outlet?.name,
                variances: variances.map((v: any) => ({
                  product: v.product?.name,
                  variance: v.variance,
                  severity: v.severity
                }))
              }
            }))

            await supabaseClient.from('notifications').insert(notifications)
          }
        }

        return new Response(
          JSON.stringify({ 
            success: true, 
            receipt,
            variances: variances.length,
            status
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      case 'cancel': {
        const { transfer_id } = data
        
        const { data: request, error: getError } = await supabaseClient
          .from('stock_transfer_requests')
          .select('requested_by, status')
          .eq('id', transfer_id)
          .single()

        if (getError) throw getError

        const { data: profile } = await supabaseClient
          .from('profiles')
          .select('role')
          .eq('id', user.id)
          .single()

        const isAdmin = profile && ['super_admin', 'super_manager'].includes(profile.role)
        const isRequester = request.requested_by === user.id

        if (!isAdmin && !isRequester) {
          return new Response(
            JSON.stringify({ error: 'Cannot cancel this request' }),
            { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }

        if (request.status === 'completed') {
          return new Response(
            JSON.stringify({ error: 'Cannot cancel completed transfer' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }

        const { error } = await supabaseClient
          .from('stock_transfer_requests')
          .update({ status: 'cancelled' })
          .eq('id', transfer_id)

        if (error) throw error

        return new Response(
          JSON.stringify({ success: true, message: 'Transfer request cancelled' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      default:
        return new Response(
          JSON.stringify({ error: 'Invalid action' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
    }
  } catch (error) {
    console.error('Transfer request error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
