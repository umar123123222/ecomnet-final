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

    const { action, data } = await req.json()

    switch (action) {
      case 'create': {
        const { productId, fromOutletId, toOutletId, quantity, notes } = data
        
        // Check if requesting user has access to from_outlet
        const { data: hasAccess } = await supabaseClient.rpc('user_has_outlet_access', {
          _user_id: user.id,
          _outlet_id: fromOutletId
        })

        if (!hasAccess) {
          return new Response(
            JSON.stringify({ error: 'No access to source outlet' }),
            { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }

        // Create transfer request
        const { data: request, error } = await supabaseClient
          .from('stock_transfer_requests')
          .insert({
            product_id: productId,
            from_outlet_id: fromOutletId,
            to_outlet_id: toOutletId,
            quantity_requested: quantity,
            notes: notes,
            requested_by: user.id,
            status: 'pending'
          })
          .select()
          .single()

        if (error) throw error

        return new Response(
          JSON.stringify({ success: true, request }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      case 'approve': {
        const { requestId, quantityApproved } = data
        
        // Get the request details
        const { data: request, error: getError } = await supabaseClient
          .from('stock_transfer_requests')
          .select('*, products_new(name)')
          .eq('id', requestId)
          .single()

        if (getError) throw getError

        // Check if user has permission to approve
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

        // Update request status
        const { error: updateError } = await supabaseClient
          .from('stock_transfer_requests')
          .update({
            status: 'approved',
            quantity_approved: quantityApproved,
            approved_by: user.id
          })
          .eq('id', requestId)

        if (updateError) throw updateError

        return new Response(
          JSON.stringify({ success: true, message: 'Transfer request approved' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      case 'reject': {
        const { requestId, reason } = data
        
        // Check if user has permission to reject
        const { data: profile } = await supabaseClient
          .from('profiles')
          .select('role')
          .eq('id', user.id)
          .single()

        const canReject = profile && ['super_admin', 'super_manager', 'warehouse_manager'].includes(profile.role)
        if (!canReject) {
          return new Response(
            JSON.stringify({ error: 'Insufficient permissions to reject' }),
            { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }

        // Update request status
        const { error } = await supabaseClient
          .from('stock_transfer_requests')
          .update({
            status: 'rejected',
            notes: reason,
            approved_by: user.id
          })
          .eq('id', requestId)

        if (error) throw error

        return new Response(
          JSON.stringify({ success: true, message: 'Transfer request rejected' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      case 'complete': {
        const { requestId } = data
        
        // Get the approved request
        const { data: request, error: getError } = await supabaseClient
          .from('stock_transfer_requests')
          .select('*')
          .eq('id', requestId)
          .eq('status', 'approved')
          .single()

        if (getError) throw getError

        if (!request) {
          return new Response(
            JSON.stringify({ error: 'Request not found or not approved' }),
            { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }

        const quantity = request.quantity_approved || request.quantity_requested

        // Update inventory - reduce from source
        const { error: reduceError } = await supabaseClient.rpc('decrement_inventory', {
          p_product_id: request.product_id,
          p_outlet_id: request.from_outlet_id,
          p_quantity: quantity
        })

        if (reduceError) throw reduceError

        // Update inventory - add to destination
        const { error: addError } = await supabaseClient.rpc('increment_inventory', {
          p_product_id: request.product_id,
          p_outlet_id: request.to_outlet_id,
          p_quantity: quantity
        })

        if (addError) throw addError

        // Create stock movement record
        const { error: movementError } = await supabaseClient
          .from('stock_movements')
          .insert({
            product_id: request.product_id,
            from_outlet_id: request.from_outlet_id,
            to_outlet_id: request.to_outlet_id,
            quantity: quantity,
            movement_type: 'transfer',
            reference_id: requestId,
            notes: `Transfer request completed`,
            performed_by: user.id,
          })

        if (movementError) throw movementError

        // Update request to completed
        const { error: completeError } = await supabaseClient
          .from('stock_transfer_requests')
          .update({
            status: 'completed',
            completed_at: new Date().toISOString()
          })
          .eq('id', requestId)

        if (completeError) throw completeError

        return new Response(
          JSON.stringify({ success: true, message: 'Transfer completed successfully' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      case 'cancel': {
        const { requestId } = data
        
        // Get the request
        const { data: request, error: getError } = await supabaseClient
          .from('stock_transfer_requests')
          .select('requested_by, status')
          .eq('id', requestId)
          .single()

        if (getError) throw getError

        // Check if user can cancel (must be requester or admin)
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

        // Update request status
        const { error } = await supabaseClient
          .from('stock_transfer_requests')
          .update({ status: 'cancelled' })
          .eq('id', requestId)

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