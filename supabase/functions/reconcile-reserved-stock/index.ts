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

    // Helper function to calculate reserved quantity including bundle expansion
    async function calculateExpectedReserved(productId: string): Promise<{ reserved: number, relatedOrders: any[] }> {
      // Direct reservations from order_items
      const { data: directOrderItems } = await supabaseClient
        .from('order_items')
        .select('quantity, order:orders!inner(id, order_number, status)')
        .eq('product_id', productId)
        .in('order.status', ['pending', 'confirmed', 'booked']);

      let reserved = 0;
      const relatedOrders: any[] = [];

      if (directOrderItems) {
        for (const item of directOrderItems) {
          reserved += item.quantity;
          relatedOrders.push({
            order_number: item.order?.order_number,
            status: item.order?.status,
            quantity: item.quantity,
            type: 'direct'
          });
        }
      }

      // Bundle reservations - when a bundle is ordered, reserve component products
      // Find all bundles that contain this product as a component
      const { data: bundleComponents } = await supabaseClient
        .from('product_bundle_items')
        .select('bundle_product_id, quantity')
        .eq('component_product_id', productId);

      if (bundleComponents && bundleComponents.length > 0) {
        for (const component of bundleComponents) {
          // Find orders containing this bundle
          const { data: bundleOrderItems } = await supabaseClient
            .from('order_items')
            .select('quantity, order:orders!inner(id, order_number, status), product:products(name)')
            .eq('product_id', component.bundle_product_id)
            .in('order.status', ['pending', 'confirmed', 'booked']);

          if (bundleOrderItems) {
            for (const item of bundleOrderItems) {
              // Each bundle order reserves (bundle_qty * component_qty) of this product
              const bundleReserved = item.quantity * component.quantity;
              reserved += bundleReserved;
              relatedOrders.push({
                order_number: item.order?.order_number,
                status: item.order?.status,
                quantity: bundleReserved,
                type: 'bundle',
                bundle_name: item.product?.name
              });
            }
          }
        }
      }

      return { reserved, relatedOrders };
    }

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
          const { reserved: expectedReserved, relatedOrders } = await calculateExpectedReserved(inv.product_id);

          // Calculate what available_quantity should be
          const expectedAvailable = inv.quantity - expectedReserved;
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
          const { reserved: expectedReserved } = await calculateExpectedReserved(inv.product_id);

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
