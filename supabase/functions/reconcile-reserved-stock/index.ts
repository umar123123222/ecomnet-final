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

    const { action, autoFix = false } = await req.json();
    console.log(`[Reconcile Reserved Stock] Action: ${action}, Auto-fix: ${autoFix}`);

    switch (action) {
      case 'analyze': {
        // Get all inventory records
        const { data: inventoryRecords, error: invError } = await supabaseClient
          .from('inventory')
          .select('id, product_id, outlet_id, quantity, reserved_quantity, available_quantity, product:products(name, sku), outlet:outlets(name)');

        if (invError) throw invError;

        const discrepancies: any[] = [];

        // For each inventory record, calculate expected reserved quantity
        for (const inv of inventoryRecords || []) {
          // Find all pending/booked orders containing this product
          const { data: orders } = await supabaseClient
            .from('orders')
            .select('id, order_number, status, order_items!inner(item_name, quantity)')
            .in('status', ['pending', 'booked', 'pending_confirmation', 'pending_address', 'pending_dispatch']);

          let expectedReserved = 0;
          const relatedOrders: any[] = [];

          if (orders) {
            for (const order of orders) {
              for (const item of order.order_items) {
                // Try to match order item to product
                if (inv.product?.name && item.item_name.toLowerCase().includes(inv.product.name.toLowerCase())) {
                  expectedReserved += item.quantity;
                  relatedOrders.push({
                    order_number: order.order_number,
                    status: order.status,
                    quantity: item.quantity
                  });
                }
              }
            }
          }

          // Calculate what available_quantity should be
          const expectedAvailable = inv.quantity - inv.reserved_quantity;
          const availableDiscrepancy = inv.available_quantity !== expectedAvailable;

          // Check if reserved quantity matches expected
          if (inv.reserved_quantity !== expectedReserved || availableDiscrepancy) {
            discrepancies.push({
              inventory_id: inv.id,
              product_name: inv.product?.name || 'Unknown',
              product_sku: inv.product?.sku || 'N/A',
              outlet_name: inv.outlet?.name || 'Unknown',
              current_quantity: inv.quantity,
              current_reserved: inv.reserved_quantity,
              expected_reserved: expectedReserved,
              reserved_difference: inv.reserved_quantity - expectedReserved,
              current_available: inv.available_quantity,
              expected_available: expectedAvailable,
              available_discrepancy: availableDiscrepancy,
              related_orders: relatedOrders,
              severity: Math.abs(inv.reserved_quantity - expectedReserved) > 10 ? 'high' : 'medium'
            });
          }
        }

        console.log(`[Reconcile] Found ${discrepancies.length} discrepancies`);

        return new Response(
          JSON.stringify({ 
            success: true, 
            total_inventory_records: inventoryRecords?.length || 0,
            discrepancies_found: discrepancies.length,
            discrepancies: discrepancies,
            message: `Found ${discrepancies.length} inventory records with reserved quantity discrepancies`
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'fix': {
        // Get all inventory records
        const { data: inventoryRecords, error: invError } = await supabaseClient
          .from('inventory')
          .select('id, product_id, outlet_id, quantity, reserved_quantity, product:products(name)');

        if (invError) throw invError;

        const fixedRecords: any[] = [];

        for (const inv of inventoryRecords || []) {
          // Find all pending orders containing this product
          const { data: orders } = await supabaseClient
            .from('orders')
            .select('order_items!inner(item_name, quantity)')
            .in('status', ['pending', 'booked', 'pending_confirmation', 'pending_address', 'pending_dispatch']);

          let expectedReserved = 0;

          if (orders) {
            for (const order of orders) {
              for (const item of order.order_items) {
                if (inv.product?.name && item.item_name.toLowerCase().includes(inv.product.name.toLowerCase())) {
                  expectedReserved += item.quantity;
                }
              }
            }
          }

          // Fix if different
          if (inv.reserved_quantity !== expectedReserved) {
            const { error: updateError } = await supabaseClient
              .from('inventory')
              .update({ reserved_quantity: expectedReserved })
              .eq('id', inv.id);

            if (!updateError) {
              fixedRecords.push({
                inventory_id: inv.id,
                product_name: inv.product?.name || 'Unknown',
                old_reserved: inv.reserved_quantity,
                new_reserved: expectedReserved,
                difference: expectedReserved - inv.reserved_quantity
              });

              // Log the fix
              await supabaseClient
                .from('activity_logs')
                .insert({
                  user_id: user.id,
                  entity_type: 'inventory',
                  entity_id: inv.id,
                  action: 'reconcile_reserved_stock',
                  details: {
                    product_name: inv.product?.name,
                    old_reserved: inv.reserved_quantity,
                    new_reserved: expectedReserved,
                    difference: expectedReserved - inv.reserved_quantity
                  }
                });
            }
          }
        }

        console.log(`[Reconcile] Fixed ${fixedRecords.length} records`);

        return new Response(
          JSON.stringify({ 
            success: true, 
            records_fixed: fixedRecords.length,
            fixed_records: fixedRecords,
            message: `Successfully reconciled ${fixedRecords.length} inventory records`
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
