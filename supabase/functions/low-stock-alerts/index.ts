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

    const { action, filters } = await req.json()

    switch (action) {
      case 'checkLowStock': {
        const { outletId } = filters || {}
        
        // Get all inventory items
        let query = supabaseClient
          .from('inventory')
          .select(`
            *,
            product:products_new(*),
            outlet:outlets(*)
          `)

        if (outletId) {
          query = query.eq('outlet_id', outletId)
        }

        const { data: inventory, error } = await query

        if (error) throw error

        // Filter items below reorder level
        const lowStockItems = inventory?.filter(item => 
          item.available_quantity <= (item.product?.reorder_level || 0)
        ) || []

        // Categorize by urgency
        const critical = lowStockItems.filter(item => item.available_quantity === 0)
        const warning = lowStockItems.filter(item => 
          item.available_quantity > 0 && 
          item.available_quantity <= (item.product?.reorder_level || 0) * 0.3
        )
        const low = lowStockItems.filter(item => 
          item.available_quantity > (item.product?.reorder_level || 0) * 0.3 &&
          item.available_quantity <= (item.product?.reorder_level || 0)
        )

        return new Response(
          JSON.stringify({ 
            all: lowStockItems,
            critical,
            warning,
            low,
            summary: {
              total: lowStockItems.length,
              critical_count: critical.length,
              warning_count: warning.length,
              low_count: low.length
            }
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      case 'getRestockSuggestions': {
        const { outletId } = filters || {}
        
        // Get low stock items
        let query = supabaseClient
          .from('inventory')
          .select(`
            *,
            product:products_new(*),
            outlet:outlets(*)
          `)

        if (outletId) {
          query = query.eq('outlet_id', outletId)
        }

        const { data: inventory, error } = await query

        if (error) throw error

        // Filter and calculate restock suggestions
        const suggestions = inventory
          ?.filter(item => item.available_quantity <= (item.product?.reorder_level || 0))
          .map(item => {
            const reorderLevel = item.product?.reorder_level || 10
            const currentQuantity = item.available_quantity
            const suggestedQuantity = Math.max(reorderLevel * 2 - currentQuantity, reorderLevel)
            
            return {
              ...item,
              suggested_restock_quantity: suggestedQuantity,
              urgency: currentQuantity === 0 ? 'critical' : 
                       currentQuantity <= reorderLevel * 0.3 ? 'high' : 'medium'
            }
          })
          .sort((a, b) => {
            const urgencyOrder = { critical: 0, high: 1, medium: 2 }
            return urgencyOrder[a.urgency] - urgencyOrder[b.urgency]
          }) || []

        return new Response(
          JSON.stringify({ suggestions }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      case 'getStockAlerts': {
        // Get user's accessible outlets
        const { data: userProfile } = await supabaseClient
          .from('profiles')
          .select('role')
          .eq('id', user.id)
          .single()

        const isSuperUser = userProfile && ['super_admin', 'super_manager'].includes(userProfile.role)

        let outletIds: string[] = []

        if (isSuperUser) {
          // Get all outlets
          const { data: outlets } = await supabaseClient
            .from('outlets')
            .select('id')
          outletIds = outlets?.map(o => o.id) || []
        } else {
          // Get user's assigned outlets
          const { data: outlets } = await supabaseClient.rpc('get_user_outlets', {
            _user_id: user.id
          })
          outletIds = outlets?.map(o => o.outlet_id).filter(Boolean) || []
        }

        // Get low stock for user's outlets
        const { data: inventory, error } = await supabaseClient
          .from('inventory')
          .select(`
            *,
            product:products_new(*),
            outlet:outlets(*)
          `)
          .in('outlet_id', outletIds)

        if (error) throw error

        const alerts = inventory
          ?.filter(item => item.available_quantity <= (item.product?.reorder_level || 0))
          .map(item => ({
            ...item,
            alert_type: item.available_quantity === 0 ? 'out_of_stock' : 'low_stock',
            severity: item.available_quantity === 0 ? 'critical' : 
                     item.available_quantity <= (item.product?.reorder_level || 0) * 0.3 ? 'high' : 'medium'
          })) || []

        return new Response(
          JSON.stringify({ 
            alerts,
            unread_count: alerts.length 
          }),
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
    console.error('Low stock alerts error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})