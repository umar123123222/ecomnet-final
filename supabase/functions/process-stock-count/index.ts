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

    const { action, data } = await req.json();
    console.log('Stock Count Operation:', action, data);

    switch (action) {
      case 'approve': {
        if (!data.count_id) {
          throw new Error('Missing count_id');
        }

        // Get count items
        const { data: countItems, error: itemsError } = await supabaseClient
          .from('stock_count_items')
          .select('*, products(*)')
          .eq('count_id', data.count_id);

        if (itemsError) throw itemsError;

        // Get count details
        const { data: count, error: countError } = await supabaseClient
          .from('stock_counts')
          .select('*')
          .eq('id', data.count_id)
          .single();

        if (countError) throw countError;

        // Update inventory for each item based on variance
        for (const item of countItems) {
          if (item.variance !== 0) {
            // Get current inventory
            const { data: inventory } = await supabaseClient
              .from('inventory')
              .select('id, quantity, available_quantity')
              .eq('product_id', item.product_id)
              .eq('outlet_id', item.outlet_id)
              .single();

            if (inventory) {
              // Adjust inventory to match counted quantity
              await supabaseClient
                .from('inventory')
                .update({
                  quantity: item.counted_quantity,
                  available_quantity: item.counted_quantity
                })
                .eq('id', inventory.id);

              // Create stock movement record
              await supabaseClient
                .from('stock_movements')
                .insert({
                  product_id: item.product_id,
                  outlet_id: item.outlet_id,
                  movement_type: 'adjustment',
                  quantity: item.variance,
                  created_by: user.id,
                  reference_id: count.id,
                  notes: `Stock count adjustment - ${count.count_number}. Reason: ${item.variance_reason || 'Count variance'}`
                });
            }
          }
        }

        // Update count status
        await supabaseClient
          .from('stock_counts')
          .update({
            status: 'approved',
            approved_by: user.id,
            approved_at: new Date().toISOString()
          })
          .eq('id', data.count_id);

        // Update all variances to resolved
        await supabaseClient
          .from('count_variances')
          .update({
            status: 'resolved',
            resolved_by: user.id,
            resolved_at: new Date().toISOString(),
            corrective_action: 'Inventory adjusted based on physical count'
          })
          .eq('count_item_id', supabaseClient.rpc('any', {
            values: countItems.map(i => i.id)
          }));

        return new Response(
          JSON.stringify({ 
            success: true, 
            message: 'Stock count approved and inventory updated',
            items_adjusted: countItems.filter(i => i.variance !== 0).length
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'reject': {
        if (!data.count_id || !data.rejection_reason) {
          throw new Error('Missing count_id or rejection_reason');
        }

        await supabaseClient
          .from('stock_counts')
          .update({
            status: 'rejected',
            notes: data.rejection_reason
          })
          .eq('id', data.count_id);

        return new Response(
          JSON.stringify({ success: true, message: 'Stock count rejected' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'calculate_statistics': {
        if (!data.count_id) {
          throw new Error('Missing count_id');
        }

        // Get all count items
        const { data: items, error: itemsError } = await supabaseClient
          .from('stock_count_items')
          .select('variance, variance_value, system_quantity, counted_quantity')
          .eq('count_id', data.count_id);

        if (itemsError) throw itemsError;

        const totalItems = items.length;
        const itemsWithVariance = items.filter(i => i.variance !== 0).length;
        const totalVarianceValue = items.reduce((sum, i) => sum + Math.abs(i.variance_value), 0);
        const accuracyRate = totalItems > 0 
          ? ((totalItems - itemsWithVariance) / totalItems * 100).toFixed(2)
          : 0;

        // Calculate variance breakdown
        const positiveVariance = items.filter(i => i.variance > 0).length;
        const negativeVariance = items.filter(i => i.variance < 0).length;
        const totalPositiveValue = items
          .filter(i => i.variance > 0)
          .reduce((sum, i) => sum + i.variance_value, 0);
        const totalNegativeValue = Math.abs(items
          .filter(i => i.variance < 0)
          .reduce((sum, i) => sum + i.variance_value, 0));

        // Update count with statistics
        await supabaseClient
          .from('stock_counts')
          .update({
            total_items_counted: totalItems,
            items_with_variance: itemsWithVariance,
            total_variance_value: totalVarianceValue
          })
          .eq('id', data.count_id);

        return new Response(
          JSON.stringify({ 
            success: true,
            statistics: {
              totalItems,
              itemsWithVariance,
              totalVarianceValue,
              accuracyRate,
              positiveVariance,
              negativeVariance,
              totalPositiveValue,
              totalNegativeValue
            }
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
