import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
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
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    const authHeader = req.headers.get('Authorization')!;
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { action, data } = await req.json();

    switch (action) {
      case 'create': {
        const {
          batch_number,
          finished_product_id,
          outlet_id,
          quantity_produced,
          production_date,
          expiry_date,
          notes,
        } = data;

        // Validate required fields
        if (!batch_number || !finished_product_id || !outlet_id || !quantity_produced) {
          return new Response(
            JSON.stringify({ error: 'Missing required fields' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Get BOM for the finished product
        const { data: bomItems, error: bomError } = await supabase
          .from('bill_of_materials')
          .select(`
            *,
            raw_material:raw_material_id(id, name, sku, product_type),
            packaging_item:packaging_item_id(id, name, sku, type)
          `)
          .eq('finished_product_id', finished_product_id);

        if (bomError) {
          console.error('BOM fetch error:', bomError);
          return new Response(
            JSON.stringify({ error: 'Failed to fetch BOM' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        if (!bomItems || bomItems.length === 0) {
          return new Response(
            JSON.stringify({ error: 'No BOM defined for this product' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Check material availability
        for (const bomItem of bomItems) {
          const requiredQty = bomItem.quantity_required * quantity_produced;
          
          if (bomItem.raw_material_id) {
            const { data: inventory } = await supabase
              .from('inventory')
              .select('available_quantity')
              .eq('product_id', bomItem.raw_material_id)
              .eq('outlet_id', outlet_id)
              .single();

            if (!inventory || inventory.available_quantity < requiredQty) {
              return new Response(
                JSON.stringify({ 
                  error: `Insufficient ${bomItem.raw_material?.name || 'material'}. Required: ${requiredQty}, Available: ${inventory?.available_quantity || 0}` 
                }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
              );
            }
          } else if (bomItem.packaging_item_id) {
            const { data: packaging } = await supabase
              .from('packaging_items')
              .select('current_stock')
              .eq('id', bomItem.packaging_item_id)
              .single();

            if (!packaging || packaging.current_stock < requiredQty) {
              return new Response(
                JSON.stringify({ 
                  error: `Insufficient ${bomItem.packaging_item?.name || 'packaging'}. Required: ${requiredQty}, Available: ${packaging?.current_stock || 0}` 
                }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
              );
            }
          }
        }

        // Create production batch
        const { data: batch, error: batchError } = await supabase
          .from('production_batches')
          .insert({
            batch_number,
            finished_product_id,
            outlet_id,
            quantity_produced,
            production_date: production_date || new Date().toISOString().split('T')[0],
            expiry_date,
            produced_by: user.id,
            status: 'in_progress',
            notes,
          })
          .select()
          .single();

        if (batchError) {
          console.error('Batch creation error:', batchError);
          return new Response(
            JSON.stringify({ error: 'Failed to create production batch' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Deduct materials and record usage
        for (const bomItem of bomItems) {
          const usedQty = bomItem.quantity_required * quantity_produced;
          
          if (bomItem.raw_material_id) {
            // Deduct from inventory
            await supabase.rpc('update_inventory_quantity', {
              p_product_id: bomItem.raw_material_id,
              p_outlet_id: outlet_id,
              p_quantity_change: -usedQty,
            });

            // Record stock movement
            await supabase.from('stock_movements').insert({
              product_id: bomItem.raw_material_id,
              outlet_id,
              movement_type: 'production_out',
              quantity: -usedQty,
              reference_id: batch.id,
              notes: `Used in production batch ${batch_number}`,
              created_by: user.id,
            });

            // Record material usage
            await supabase.from('production_material_usage').insert({
              production_batch_id: batch.id,
              raw_material_id: bomItem.raw_material_id,
              quantity_used: usedQty,
            });
          } else if (bomItem.packaging_item_id) {
            // Deduct from packaging inventory
            await supabase
              .from('packaging_items')
              .update({ current_stock: supabase.raw(`current_stock - ${usedQty}`) })
              .eq('id', bomItem.packaging_item_id);

            // Record material usage
            await supabase.from('production_material_usage').insert({
              production_batch_id: batch.id,
              packaging_item_id: bomItem.packaging_item_id,
              quantity_used: usedQty,
            });
          }
        }

        // Add finished products to inventory
        const { data: existingInventory } = await supabase
          .from('inventory')
          .select('id')
          .eq('product_id', finished_product_id)
          .eq('outlet_id', outlet_id)
          .single();

        if (existingInventory) {
          await supabase.rpc('update_inventory_quantity', {
            p_product_id: finished_product_id,
            p_outlet_id: outlet_id,
            p_quantity_change: quantity_produced,
          });
        } else {
          await supabase.from('inventory').insert({
            product_id: finished_product_id,
            outlet_id,
            quantity: quantity_produced,
            available_quantity: quantity_produced,
          });
        }

        // Record stock movement for finished product
        await supabase.from('stock_movements').insert({
          product_id: finished_product_id,
          outlet_id,
          movement_type: 'production_in',
          quantity: quantity_produced,
          reference_id: batch.id,
          notes: `Produced in batch ${batch_number}`,
          created_by: user.id,
        });

        return new Response(JSON.stringify({ success: true, batch }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'complete': {
        const { batch_id } = data;

        const { error: updateError } = await supabase
          .from('production_batches')
          .update({
            status: 'completed',
            completed_at: new Date().toISOString(),
          })
          .eq('id', batch_id);

        if (updateError) {
          return new Response(
            JSON.stringify({ error: 'Failed to complete batch' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'cancel': {
        const { batch_id, reason } = data;

        const { error: updateError } = await supabase
          .from('production_batches')
          .update({
            status: 'cancelled',
            notes: reason,
          })
          .eq('id', batch_id);

        if (updateError) {
          return new Response(
            JSON.stringify({ error: 'Failed to cancel batch' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      default:
        return new Response(JSON.stringify({ error: 'Invalid action' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }
  } catch (error) {
    console.error('Error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
