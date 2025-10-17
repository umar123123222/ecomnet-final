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
    console.log('GRN Operation:', action, data);

    switch (action) {
      case 'create': {
        // Validate required fields
        if (!data.po_id || !data.items || data.items.length === 0) {
          throw new Error('Missing required fields: po_id and items are required');
        }

        // Get PO details
        const { data: po, error: poError } = await supabaseClient
          .from('purchase_orders')
          .select(`
            *, 
            purchase_order_items(*, products(*), packaging_items(*))
          `)
          .eq('id', data.po_id)
          .single();

        if (poError) throw poError;

        // Generate GRN number
        const year = new Date().getFullYear();
        const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
        const grnNumber = `GRN-${year}-${random}`;

        // Calculate totals and check for discrepancies
        let totalExpected = 0;
        let totalReceived = 0;
        let hasDiscrepancy = false;

        const items = data.items.map((item: any) => {
          totalExpected += item.quantity_expected;
          totalReceived += item.quantity_received;
          
          if (item.quantity_received !== item.quantity_expected) {
            hasDiscrepancy = true;
          }

          return item;
        });

        // Create GRN
        const { data: grn, error: grnError } = await supabaseClient
          .from('goods_received_notes')
          .insert({
            grn_number: grnNumber,
            po_id: data.po_id,
            supplier_id: po.supplier_id,
            outlet_id: po.outlet_id,
            received_by: user.id,
            total_items_expected: totalExpected,
            total_items_received: totalReceived,
            discrepancy_flag: hasDiscrepancy,
            notes: data.notes,
            status: 'pending_inspection'
          })
          .select()
          .single();

        if (grnError) throw grnError;

        // Create GRN items
        const grnItems = items.map((item: any) => ({
          grn_id: grn.id,
          po_item_id: item.po_item_id,
          product_id: item.product_id,
          packaging_item_id: item.packaging_item_id,
          quantity_expected: item.quantity_expected,
          quantity_received: item.quantity_received,
          unit_cost: item.unit_cost,
          batch_number: item.batch_number,
          expiry_date: item.expiry_date,
          notes: item.notes,
          quality_status: 'pending'
        }));

        const { error: itemsError } = await supabaseClient
          .from('grn_items')
          .insert(grnItems);

        if (itemsError) throw itemsError;

        // Send notifications if there are discrepancies
        if (hasDiscrepancy) {
          // Get managers (super_admin, super_manager, warehouse_manager)
          const { data: managers } = await supabaseClient
            .from('user_roles')
            .select('user_id, profiles(email, full_name)')
            .in('role', ['super_admin', 'super_manager', 'warehouse_manager'])
            .eq('is_active', true);

          // Get supplier contact info
          const { data: supplier } = await supabaseClient
            .from('suppliers')
            .select('name, contact_person, email, phone')
            .eq('id', po.supplier_id)
            .single();

          const discrepancyDetails = items
            .filter((item: any) => item.quantity_received !== item.quantity_expected)
            .map((item: any) => {
              const product = po.purchase_order_items.find((poi: any) => poi.id === item.po_item_id);
              return `- ${product?.products?.name || product?.packaging_items?.name}: Expected ${item.quantity_expected}, Received ${item.quantity_received}`;
            })
            .join('\n');

          const notificationMessage = `Quantity discrepancies detected in GRN ${grnNumber} for PO ${po.po_number}:\n\n${discrepancyDetails}`;

          // Notify managers
          if (managers) {
            const managerNotifications = managers.map((manager: any) => ({
              user_id: manager.user_id,
              title: 'GRN Quantity Discrepancy',
              message: notificationMessage,
              type: 'warning',
              priority: 'high',
              action_url: `/receiving`,
              metadata: { grn_id: grn.id, po_id: data.po_id }
            }));

            await supabaseClient
              .from('notifications')
              .insert(managerNotifications);
          }

          // Notify supplier via WhatsApp if phone available
          if (supplier?.phone) {
            try {
              await supabaseClient.functions.invoke('send-whatsapp', {
                body: {
                  to: supplier.phone,
                  message: `Dear ${supplier.contact_person || supplier.name},\n\n${notificationMessage}\n\nPlease contact us to resolve this issue.`
                }
              });
            } catch (whatsappError) {
              console.error('Failed to send WhatsApp to supplier:', whatsappError);
            }
          }
        }

        // Update PO items received quantities
        for (const item of items) {
          await supabaseClient
            .from('purchase_order_items')
            .update({
              quantity_received: supabaseClient.rpc('increment', {
                x: item.quantity_received
              })
            })
            .eq('id', item.po_item_id);
        }

        // Check if PO is fully received
        const { data: poItems } = await supabaseClient
          .from('purchase_order_items')
          .select('quantity_ordered, quantity_received')
          .eq('po_id', data.po_id);

        const fullyReceived = poItems?.every(
          (item: any) => item.quantity_received >= item.quantity_ordered
        );

        const partiallyReceived = poItems?.some(
          (item: any) => item.quantity_received > 0
        );

        const newPOStatus = fullyReceived ? 'completed' : 
                           partiallyReceived ? 'partially_received' : 'confirmed';

        await supabaseClient
          .from('purchase_orders')
          .update({ status: newPOStatus })
          .eq('id', data.po_id);

        return new Response(
          JSON.stringify({ 
            success: true, 
            grn, 
            hasDiscrepancy,
            message: 'GRN created successfully' 
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'accept': {
        if (!data.grn_id) {
          throw new Error('Missing grn_id');
        }

        // Get GRN items
        const { data: grnItems, error: itemsError } = await supabaseClient
          .from('grn_items')
          .select('*, products(*)')
          .eq('grn_id', data.grn_id);

        if (itemsError) throw itemsError;

        // Get GRN details
        const { data: grn, error: grnError } = await supabaseClient
          .from('goods_received_notes')
          .select('*')
          .eq('id', data.grn_id)
          .single();

        if (grnError) throw grnError;

        // Update inventory for each item
        for (const item of grnItems) {
          const qtyToAdd = item.quantity_accepted || item.quantity_received;
          
          // Check if inventory record exists
          const { data: existingInv } = await supabaseClient
            .from('inventory')
            .select('id, quantity')
            .eq('product_id', item.product_id)
            .eq('outlet_id', grn.outlet_id)
            .single();

          if (existingInv) {
            // Update existing inventory
            await supabaseClient
              .from('inventory')
              .update({
                quantity: existingInv.quantity + qtyToAdd,
                available_quantity: existingInv.quantity + qtyToAdd,
                last_restocked_at: new Date().toISOString()
              })
              .eq('id', existingInv.id);
          } else {
            // Create new inventory record
            await supabaseClient
              .from('inventory')
              .insert({
                product_id: item.product_id,
                outlet_id: grn.outlet_id,
                quantity: qtyToAdd,
                available_quantity: qtyToAdd,
                reserved_quantity: 0,
                last_restocked_at: new Date().toISOString()
              });
          }

          // Create stock movement record
          await supabaseClient
            .from('stock_movements')
            .insert({
              product_id: item.product_id,
              outlet_id: grn.outlet_id,
              movement_type: 'purchase',
              quantity: qtyToAdd,
              created_by: user.id,
              reference_id: grn.id,
              notes: `GRN ${grn.grn_number}`
            });
        }

        // Update GRN status
        await supabaseClient
          .from('goods_received_notes')
          .update({
            status: 'accepted',
            inspected_by: user.id,
            inspected_at: new Date().toISOString(),
            quality_passed: true
          })
          .eq('id', data.grn_id);

        return new Response(
          JSON.stringify({ 
            success: true, 
            message: 'GRN accepted and inventory updated' 
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'reject': {
        if (!data.grn_id || !data.rejection_reason) {
          throw new Error('Missing grn_id or rejection_reason');
        }

        await supabaseClient
          .from('goods_received_notes')
          .update({
            status: 'rejected',
            inspected_by: user.id,
            inspected_at: new Date().toISOString(),
            quality_passed: false,
            rejection_reason: data.rejection_reason
          })
          .eq('id', data.grn_id);

        return new Response(
          JSON.stringify({ success: true, message: 'GRN rejected' }),
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
