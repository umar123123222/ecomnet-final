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

    const { reportType, filters } = await req.json()

    switch (reportType) {
      case 'stockLevels': {
        const { outletId } = filters || {}
        
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

        const { data, error } = await query

        if (error) throw error

        return new Response(
          JSON.stringify({ data }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      case 'lowStock': {
        const { outletId } = filters || {}
        
        // Get inventory with products that are below reorder level
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

        return new Response(
          JSON.stringify({ data: lowStockItems, count: lowStockItems.length }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      case 'stockMovements': {
        const { outletId, startDate, endDate, movementType } = filters || {}
        
        let query = supabaseClient
          .from('stock_movements')
          .select(`
            *,
            product:products_new(*),
            from_outlet:outlets!stock_movements_from_outlet_id_fkey(*),
            to_outlet:outlets!stock_movements_to_outlet_id_fkey(*),
            performer:profiles(full_name)
          `)
          .order('created_at', { ascending: false })

        if (outletId) {
          query = query.or(`from_outlet_id.eq.${outletId},to_outlet_id.eq.${outletId}`)
        }

        if (startDate) {
          query = query.gte('created_at', startDate)
        }

        if (endDate) {
          query = query.lte('created_at', endDate)
        }

        if (movementType) {
          query = query.eq('movement_type', movementType)
        }

        const { data, error } = await query.limit(100)

        if (error) throw error

        return new Response(
          JSON.stringify({ data }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      case 'transferHistory': {
        const { outletId, status } = filters || {}
        
        let query = supabaseClient
          .from('stock_transfer_requests')
          .select(`
            *,
            product:products_new(*),
            from_outlet:outlets!stock_transfer_requests_from_outlet_id_fkey(*),
            to_outlet:outlets!stock_transfer_requests_to_outlet_id_fkey(*),
            requester:profiles!stock_transfer_requests_requested_by_fkey(full_name),
            approver:profiles!stock_transfer_requests_approved_by_fkey(full_name)
          `)
          .order('created_at', { ascending: false })

        if (outletId) {
          query = query.or(`from_outlet_id.eq.${outletId},to_outlet_id.eq.${outletId}`)
        }

        if (status) {
          query = query.eq('status', status)
        }

        const { data, error } = await query.limit(100)

        if (error) throw error

        return new Response(
          JSON.stringify({ data }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      case 'stockValuation': {
        const { outletId } = filters || {}
        
        let query = supabaseClient
          .from('inventory')
          .select(`
            *,
            product:products_new(name, sku, price, cost_price),
            outlet:outlets(name)
          `)

        if (outletId) {
          query = query.eq('outlet_id', outletId)
        }

        const { data: inventory, error } = await query

        if (error) throw error

        // Calculate valuations
        const valuations = inventory?.map(item => ({
          ...item,
          retail_value: (item.product?.price || 0) * item.quantity,
          cost_value: (item.product?.cost_price || 0) * item.quantity,
          potential_profit: ((item.product?.price || 0) - (item.product?.cost_price || 0)) * item.quantity
        })) || []

        const summary = {
          total_retail_value: valuations.reduce((sum, item) => sum + item.retail_value, 0),
          total_cost_value: valuations.reduce((sum, item) => sum + item.cost_value, 0),
          total_potential_profit: valuations.reduce((sum, item) => sum + item.potential_profit, 0),
          total_items: valuations.reduce((sum, item) => sum + item.quantity, 0)
        }

        return new Response(
          JSON.stringify({ data: valuations, summary }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      case 'productPerformance': {
        const { outletId, startDate, endDate } = filters || {}
        
        // Get sales movements
        let query = supabaseClient
          .from('stock_movements')
          .select(`
            product_id,
            quantity,
            from_outlet_id,
            product:products_new(name, sku, price)
          `)
          .eq('movement_type', 'sale')

        if (outletId) {
          query = query.eq('from_outlet_id', outletId)
        }

        if (startDate) {
          query = query.gte('created_at', startDate)
        }

        if (endDate) {
          query = query.lte('created_at', endDate)
        }

        const { data: movements, error } = await query

        if (error) throw error

        // Aggregate by product
        const productSales = movements?.reduce((acc, movement) => {
          const key = movement.product_id
          if (!acc[key]) {
            acc[key] = {
              product: movement.product,
              total_quantity: 0,
              total_revenue: 0
            }
          }
          acc[key].total_quantity += movement.quantity
          acc[key].total_revenue += movement.quantity * (movement.product?.price || 0)
          return acc
        }, {} as Record<string, any>) || {}

        const performanceData = Object.values(productSales).sort((a: any, b: any) => 
          b.total_revenue - a.total_revenue
        )

        return new Response(
          JSON.stringify({ data: performanceData }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      default:
        return new Response(
          JSON.stringify({ error: 'Invalid report type' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
    }
  } catch (error) {
    console.error('Report generation error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})