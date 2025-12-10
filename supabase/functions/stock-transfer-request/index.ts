import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Helper function to get notification recipients
async function getNotificationRecipients(supabaseClient: any, requesterId: string | null) {
  const recipients: Array<{ id: string; email: string; full_name: string }> = []
  const recipientIds = new Set<string>()

  // Get requester info
  if (requesterId) {
    const { data: requester } = await supabaseClient
      .from('profiles')
      .select('id, email, full_name')
      .eq('id', requesterId)
      .single()
    
    if (requester && !recipientIds.has(requester.id)) {
      recipientIds.add(requester.id)
      recipients.push(requester)
    }
  }

  // Get super_admin, super_manager, warehouse_manager
  const { data: managers } = await supabaseClient
    .from('profiles')
    .select('id, email, full_name')
    .in('role', ['super_admin', 'super_manager', 'warehouse_manager'])

  if (managers) {
    for (const manager of managers) {
      if (!recipientIds.has(manager.id)) {
        recipientIds.add(manager.id)
        recipients.push(manager)
      }
    }
  }

  return recipients
}

// Helper function to create portal notifications
async function createPortalNotifications(
  supabaseClient: any,
  recipients: Array<{ id: string }>,
  notification: {
    title: string
    message: string
    type: string
    priority: string
    action_url: string
    metadata: Record<string, any>
  }
) {
  const notifications = recipients.map(recipient => ({
    user_id: recipient.id,
    ...notification
  }))

  if (notifications.length > 0) {
    const { error } = await supabaseClient.from('notifications').insert(notifications)
    if (error) {
      console.error('Error creating portal notifications:', error)
    } else {
      console.log(`Created ${notifications.length} portal notifications`)
    }
  }
}

// Helper function to send email notifications via edge function
async function sendEmailNotifications(
  supabaseClient: any,
  transferId: string,
  notificationType: string,
  additionalData?: Record<string, any>
) {
  try {
    const { error } = await supabaseClient.functions.invoke('send-transfer-notification', {
      body: {
        transfer_id: transferId,
        notification_type: notificationType,
        additional_data: additionalData
      }
    })
    
    if (error) {
      console.error('Error sending email notifications:', error)
    } else {
      console.log(`Email notifications sent for ${notificationType}`)
    }
  } catch (err) {
    console.error('Failed to invoke send-transfer-notification:', err)
  }
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
        const { 
          product_id, quantity_requested,
          items, packaging_items,
          from_outlet_id, to_outlet_id, notes,
          fromOutletId, toOutletId
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
          .select(`
            *,
            from_outlet:outlets!stock_transfer_requests_from_outlet_id_fkey(id, name),
            to_outlet:outlets!stock_transfer_requests_to_outlet_id_fkey(id, name)
          `)
          .single()

        if (error) throw error

        // Handle items
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
          }
        }

        // NOTIFICATIONS: Transfer Created
        const recipients = await getNotificationRecipients(supabaseClient, user.id)
        const toOutletName = request.to_outlet?.name || 'Unknown Store'
        const fromOutletName = request.from_outlet?.name || 'Warehouse'
        const itemCount = productItems.length

        await createPortalNotifications(supabaseClient, recipients, {
          title: 'New Stock Transfer Request',
          message: `Transfer request from ${fromOutletName} to ${toOutletName} with ${itemCount} item(s) created`,
          type: 'info',
          priority: 'normal',
          action_url: '/stock-transfer',
          metadata: {
            transfer_id: request.id,
            from_outlet: fromOutletName,
            to_outlet: toOutletName,
            item_count: itemCount
          }
        })

        // Send email notifications (background)
        sendEmailNotifications(supabaseClient, request.id, 'created')

        return new Response(
          JSON.stringify({ success: true, request }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      case 'approve': {
        const { transfer_id, quantity_approved, items_approved, packaging_items_approved } = data
        
        const { data: request, error: getError } = await supabaseClient
          .from('stock_transfer_requests')
          .select(`
            *,
            from_outlet:outlets!stock_transfer_requests_from_outlet_id_fkey(id, name),
            to_outlet:outlets!stock_transfer_requests_to_outlet_id_fkey(id, name)
          `)
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

        // NOTIFICATIONS: Transfer Approved
        const recipients = await getNotificationRecipients(supabaseClient, request.requested_by)
        const toOutletName = request.to_outlet?.name || 'Unknown Store'

        await createPortalNotifications(supabaseClient, recipients, {
          title: 'Stock Transfer Approved',
          message: `Transfer request to ${toOutletName} has been approved and is ready for dispatch`,
          type: 'success',
          priority: 'normal',
          action_url: '/stock-transfer',
          metadata: {
            transfer_id: transfer_id,
            to_outlet: toOutletName
          }
        })

        sendEmailNotifications(supabaseClient, transfer_id, 'approved')

        return new Response(
          JSON.stringify({ success: true, message: 'Transfer request approved' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      case 'reject': {
        const { transfer_id, rejection_reason } = data
        
        const { data: request, error: getError } = await supabaseClient
          .from('stock_transfer_requests')
          .select(`
            *,
            from_outlet:outlets!stock_transfer_requests_from_outlet_id_fkey(id, name),
            to_outlet:outlets!stock_transfer_requests_to_outlet_id_fkey(id, name)
          `)
          .eq('id', transfer_id)
          .single()

        if (getError) throw getError

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

        // NOTIFICATIONS: Transfer Rejected
        const recipients = await getNotificationRecipients(supabaseClient, request.requested_by)
        const toOutletName = request.to_outlet?.name || 'Unknown Store'

        await createPortalNotifications(supabaseClient, recipients, {
          title: 'Stock Transfer Rejected',
          message: `Transfer request to ${toOutletName} was rejected. Reason: ${rejection_reason || 'No reason provided'}`,
          type: 'warning',
          priority: 'high',
          action_url: '/stock-transfer',
          metadata: {
            transfer_id: transfer_id,
            to_outlet: toOutletName,
            rejection_reason: rejection_reason
          }
        })

        sendEmailNotifications(supabaseClient, transfer_id, 'rejected', { rejection_reason })

        return new Response(
          JSON.stringify({ success: true, message: 'Transfer request rejected' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      case 'dispatch': {
        // Warehouse manager marks transfer as dispatched (deducts from warehouse, doesn't add to store yet)
        const { transfer_id } = data
        
        // Get the approved request with items and packaging
        const { data: request, error: getError } = await supabaseClient
          .from('stock_transfer_requests')
          .select(`
            *,
            from_outlet:outlets!stock_transfer_requests_from_outlet_id_fkey(id, name),
            to_outlet:outlets!stock_transfer_requests_to_outlet_id_fkey(id, name),
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

        // Check permissions
        const { data: profile } = await supabaseClient
          .from('profiles')
          .select('role')
          .eq('id', user.id)
          .single()

        const canDispatch = profile && ['super_admin', 'super_manager', 'warehouse_manager'].includes(profile.role)
        if (!canDispatch) {
          return new Response(
            JSON.stringify({ error: 'Insufficient permissions to dispatch' }),
            { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }

        // Deduct product items from warehouse ONLY (transfer_out)
        for (const item of request.items) {
          const quantity = item.quantity_approved || item.quantity_requested

          const { error: movementError } = await supabaseClient
            .from('stock_movements')
            .insert({
              product_id: item.product_id,
              outlet_id: request.from_outlet_id,
              quantity: -quantity,
              movement_type: 'transfer_out',
              reference_id: transfer_id,
              notes: `Dispatched to ${request.to_outlet?.name || 'store'}`,
              created_by: user.id,
            })

          if (movementError) throw movementError
        }

        // Deduct packaging items from warehouse
        if (request.packaging_items && request.packaging_items.length > 0) {
          for (const packItem of request.packaging_items) {
            const quantity = packItem.quantity_approved || packItem.quantity_requested

            const { error: packMovementError } = await supabaseClient
              .from('packaging_movements')
              .insert({
                packaging_item_id: packItem.packaging_item_id,
                movement_type: 'dispatch',
                quantity: -quantity,
                reference_id: transfer_id,
                notes: `Transfer dispatched to ${request.to_outlet?.name || 'store'}`,
                created_by: user.id
              })

            if (packMovementError) {
              console.error('Error creating packaging movement:', packMovementError)
            }
          }
        }

        // Update status to in_transit (dispatched)
        const { error: dispatchError } = await supabaseClient
          .from('stock_transfer_requests')
          .update({
            status: 'in_transit',
            completed_by: user.id
          })
          .eq('id', transfer_id)

        if (dispatchError) throw dispatchError

        // NOTIFICATIONS: Transfer Dispatched
        const recipients = await getNotificationRecipients(supabaseClient, request.requested_by)
        const toOutletName = request.to_outlet?.name || 'Unknown Store'
        const fromOutletName = request.from_outlet?.name || 'Warehouse'
        const itemCount = request.items?.length || 0

        await createPortalNotifications(supabaseClient, recipients, {
          title: 'Stock Transfer Dispatched',
          message: `Inventory dispatched from ${fromOutletName} to ${toOutletName}. ${itemCount} item(s) ready to receive.`,
          type: 'info',
          priority: 'high',
          action_url: '/stock-transfer',
          metadata: {
            transfer_id: transfer_id,
            from_outlet: fromOutletName,
            to_outlet: toOutletName,
            item_count: itemCount
          }
        })

        sendEmailNotifications(supabaseClient, transfer_id, 'dispatched')

        return new Response(
          JSON.stringify({ success: true, message: 'Transfer dispatched - store can now receive inventory' }),
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
            from_outlet:outlets!stock_transfer_requests_from_outlet_id_fkey(id, name),
            to_outlet:outlets!stock_transfer_requests_to_outlet_id_fkey(id, name),
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

            const { error: packMovementError } = await supabaseClient
              .from('packaging_movements')
              .insert({
                packaging_item_id: packItem.packaging_item_id,
                movement_type: 'dispatch',
                quantity: -quantity,
                reference_id: transfer_id,
                notes: `Transfer to outlet`,
                created_by: user.id
              })

            if (packMovementError) {
              console.error('Error creating packaging movement:', packMovementError)
            }

            await supabaseClient.rpc('decrement_packaging_stock', {
              p_packaging_item_id: packItem.packaging_item_id,
              p_quantity: quantity
            }).catch(() => {
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

        // NOTIFICATIONS: Transfer Dispatched
        const recipients = await getNotificationRecipients(supabaseClient, request.requested_by)
        const toOutletName = request.to_outlet?.name || 'Unknown Store'
        const fromOutletName = request.from_outlet?.name || 'Warehouse'
        const itemCount = request.items?.length || 0

        await createPortalNotifications(supabaseClient, recipients, {
          title: 'Stock Transfer Dispatched',
          message: `Inventory has been dispatched from ${fromOutletName} to ${toOutletName} with ${itemCount} item(s)`,
          type: 'info',
          priority: 'high',
          action_url: '/stock-transfer',
          metadata: {
            transfer_id: transfer_id,
            from_outlet: fromOutletName,
            to_outlet: toOutletName,
            item_count: itemCount
          }
        })

        sendEmailNotifications(supabaseClient, transfer_id, 'dispatched')

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

        // Verify transfer is in in_transit status (or approved for backwards compatibility)
        if (transfer.status !== 'in_transit' && transfer.status !== 'approved') {
          return new Response(
            JSON.stringify({ error: 'Transfer must be dispatched before receiving' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }

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
            variances.push({
              ...varianceRecord,
              product: transferItem.product?.name,
              expected: item.quantity_expected,
              received: item.quantity_received
            })
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

          await supabaseClient
            .from('stock_transfer_packaging_items')
            .update({ quantity_received: item.quantity_received })
            .eq('id', item.transfer_packaging_item_id)

          const { error: packMovementError } = await supabaseClient
            .from('packaging_movements')
            .insert({
              packaging_item_id: packagingItem.packaging_item_id,
              movement_type: 'adjustment',
              quantity: item.quantity_received,
              reference_id: transfer_id,
              notes: `Transfer receipt from ${transfer.from_outlet?.name || 'warehouse'}`,
              created_by: user.id
            })

          if (packMovementError) {
            console.error('Error creating packaging receipt movement:', packMovementError)
          }
        }

        const status = 'completed' // Always completed on receive (variances are tracked separately)
        const { error: updateError } = await supabaseClient
          .from('stock_transfer_requests')
          .update({ 
            status: status,
            completed_at: new Date().toISOString()
          })
          .eq('id', transfer_id)

        if (updateError) throw updateError

        // NOTIFICATIONS: Transfer Received (always notify, with or without variance)
        const recipients = await getNotificationRecipients(supabaseClient, transfer.requested_by)
        const toOutletName = transfer.to_outlet?.name || 'Unknown Store'

        if (variances.length > 0) {
          // Notification with variance warning
          await createPortalNotifications(supabaseClient, recipients, {
            title: 'Transfer Variance Detected',
            message: `Transfer to ${toOutletName} has variances. ${variances.length} item(s) with discrepancies detected.`,
            type: 'warning',
            priority: 'high',
            action_url: '/stock-transfer',
            metadata: {
              transfer_id: transfer_id,
              outlet_name: toOutletName,
              variances: variances.map((v: any) => ({
                product: v.product,
                variance: v.variance,
                severity: v.severity,
                expected: v.expected,
                received: v.received
              }))
            }
          })

          sendEmailNotifications(supabaseClient, transfer_id, 'variance', { variances })
        } else {
          // Notification for successful receipt
          await createPortalNotifications(supabaseClient, recipients, {
            title: 'Stock Transfer Received',
            message: `Transfer to ${toOutletName} has been received successfully with no discrepancies.`,
            type: 'success',
            priority: 'normal',
            action_url: '/stock-transfer',
            metadata: {
              transfer_id: transfer_id,
              outlet_name: toOutletName
            }
          })

          sendEmailNotifications(supabaseClient, transfer_id, 'received')
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
