import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Helper function to update inventory
async function updateInventory(
  supabaseClient: any,
  userId: string,
  grnId: string,
  grnNumber: string,
  outletId: string,
  items: any[]
) {
  for (const item of items) {
    const qtyToAdd = item.quantity_received;
    
    if (qtyToAdd <= 0) continue;
    
    if (item.product_id) {
      // Handle PRODUCT inventory
      const { data: existingInv } = await supabaseClient
        .from('inventory')
        .select('id, quantity')
        .eq('product_id', item.product_id)
        .eq('outlet_id', outletId)
        .single();

      if (existingInv) {
        await supabaseClient
          .from('inventory')
          .update({
            quantity: existingInv.quantity + qtyToAdd,
            available_quantity: existingInv.quantity + qtyToAdd,
            last_restocked_at: new Date().toISOString()
          })
          .eq('id', existingInv.id);
      } else {
        await supabaseClient
          .from('inventory')
          .insert({
            product_id: item.product_id,
            outlet_id: outletId,
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
          outlet_id: outletId,
          movement_type: 'purchase',
          quantity: qtyToAdd,
          created_by: userId,
          reference_id: grnId,
          notes: `GRN ${grnNumber}`
        });
    } else if (item.packaging_item_id) {
      // Handle PACKAGING inventory
      const { data: packagingItem } = await supabaseClient
        .from('packaging_items')
        .select('id, current_stock')
        .eq('id', item.packaging_item_id)
        .single();

      if (packagingItem) {
        await supabaseClient
          .from('packaging_items')
          .update({
            current_stock: (packagingItem.current_stock || 0) + qtyToAdd,
            updated_at: new Date().toISOString()
          })
          .eq('id', item.packaging_item_id);
      }

      // Create packaging movement record
      await supabaseClient
        .from('packaging_movements')
        .insert({
          packaging_item_id: item.packaging_item_id,
          movement_type: 'purchase',
          quantity: qtyToAdd,
          created_by: userId,
          reference_id: grnId,
          notes: `GRN ${grnNumber}`
        });
    }
  }
}

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

        // Check if a GRN already exists for this PO (prevent duplicates - including rejected)
        const { data: existingGRN, error: existingError } = await supabaseClient
          .from('goods_received_notes')
          .select('id, grn_number, status')
          .eq('po_id', data.po_id)
          .in('status', ['pending_inspection', 'inspected', 'accepted', 'partial_accept', 'rejected'])
          .maybeSingle();

        if (existingError) {
          console.error('Error checking existing GRN:', existingError);
        }

        if (existingGRN) {
          const message = existingGRN.status === 'rejected' 
            ? `This PO has a rejected GRN (${existingGRN.grn_number}). No re-receiving allowed.`
            : `A GRN (${existingGRN.grn_number}) already exists for this PO. Please resolve the existing GRN first.`;
          throw new Error(message);
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

        // Calculate totals and determine GRN status
        let totalExpected = 0;
        let totalReceived = 0;
        let hasUnderReceiving = false;
        let hasOverReceiving = false;

        const items = data.items.map((item: any) => {
          totalExpected += item.quantity_expected;
          totalReceived += item.quantity_received;
          
          if (item.quantity_received < item.quantity_expected) {
            hasUnderReceiving = true;
          }
          if (item.quantity_received > item.quantity_expected) {
            hasOverReceiving = true;
          }

          return item;
        });

        // Determine GRN status based on receiving logic:
        // - All items match or over-received → accepted
        // - Any item under-received → partial_accept
        let grnStatus: string;
        let poStatus: string;
        let hasDiscrepancy = false;

        if (hasUnderReceiving) {
          // Under-receiving: auto partial accept
          grnStatus = 'partial_accept';
          poStatus = 'partially_received';
          hasDiscrepancy = true;
        } else {
          // All items received (exact or over) → auto accept
          grnStatus = 'accepted';
          poStatus = 'completed';
          hasDiscrepancy = hasOverReceiving; // Over-receiving is noted but still accepted
        }

        // Create GRN with auto-determined status
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
            status: grnStatus,
            inspected_by: user.id,
            inspected_at: new Date().toISOString(),
            quality_passed: true
          })
          .select()
          .single();

        if (grnError) throw grnError;

        // Create GRN items
        const grnItems = items.map((item: any) => ({
          grn_id: grn.id,
          po_item_id: item.po_item_id,
          product_id: item.product_id || null,
          packaging_item_id: item.packaging_item_id || null,
          quantity_expected: item.quantity_expected || 0,
          quantity_received: item.quantity_received || 0,
          quantity_accepted: item.quantity_received || 0,
          unit_cost: item.unit_cost || 0,
          batch_number: item.batch_number || null,
          expiry_date: item.expiry_date || null,
          notes: item.notes || null,
          quality_status: 'accepted',
          defect_type: item.damage_reason || null
        }));

        const { error: itemsError } = await supabaseClient
          .from('grn_items')
          .insert(grnItems);

        if (itemsError) throw itemsError;

        // IMMEDIATE STOCK UPDATE: Update inventory right away based on received quantities
        await updateInventory(supabaseClient, user.id, grn.id, grnNumber, po.outlet_id, items);
        console.log(`Inventory updated immediately for GRN ${grnNumber}`);

        // Update PO items received quantities
        for (const item of items) {
          const { data: currentItem } = await supabaseClient
            .from('purchase_order_items')
            .select('quantity_received')
            .eq('id', item.po_item_id)
            .single();

          await supabaseClient
            .from('purchase_order_items')
            .update({
              quantity_received: (currentItem?.quantity_received || 0) + item.quantity_received
            })
            .eq('id', item.po_item_id);
        }

        // Update PO status
        await supabaseClient
          .from('purchase_orders')
          .update({ 
            status: poStatus,
            received_at: new Date().toISOString()
          })
          .eq('id', data.po_id);

        // Get user profile for email
        const { data: userProfile } = await supabaseClient
          .from('profiles')
          .select('full_name')
          .eq('id', user.id)
          .single();

        // Send notifications if there are discrepancies (under-receiving)
        if (hasUnderReceiving) {
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
            .filter((item: any) => item.quantity_received < item.quantity_expected)
            .map((item: any) => {
              const product = po.purchase_order_items.find((poi: any) => poi.id === item.po_item_id);
              return `- ${product?.products?.name || product?.packaging_items?.name}: Expected ${item.quantity_expected}, Received ${item.quantity_received}`;
            })
            .join('\n');

          const notificationMessage = `Partial receiving for GRN ${grnNumber} (PO ${po.po_number}):\n\n${discrepancyDetails}\n\nInventory updated with received quantities.`;

          // Notify managers
          if (managers) {
            const managerNotifications = managers.map((manager: any) => ({
              user_id: manager.user_id,
              title: 'GRN Partial Receiving',
              message: notificationMessage,
              type: 'warning',
              priority: 'normal',
              action_url: `/receiving`,
              metadata: { grn_id: grn.id, po_id: data.po_id }
            }));

            await supabaseClient
              .from('notifications')
              .insert(managerNotifications);
          }

          // Send discrepancy email to supplier
          try {
            const serviceClient = createClient(
              Deno.env.get('SUPABASE_URL') ?? '',
              Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
            );

            const discrepancyItems = items
              .filter((item: any) => item.quantity_received < item.quantity_expected)
              .map((item: any) => {
                const product = po.purchase_order_items.find((poi: any) => poi.id === item.po_item_id);
                return {
                  name: product?.products?.name || product?.packaging_items?.name || 'Unknown',
                  expected: item.quantity_expected,
                  received: item.quantity_received,
                  variance: item.quantity_expected - item.quantity_received,
                  defect_type: item.damage_reason
                };
              });

            await serviceClient.functions.invoke('send-po-lifecycle-email', {
              body: {
                po_id: data.po_id,
                notification_type: 'discrepancy',
                additional_data: {
                  grn_number: grnNumber,
                  discrepancy_items: discrepancyItems,
                  notes: data.notes
                }
              }
            });
            console.log('Discrepancy email sent to supplier');
          } catch (emailError) {
            console.error('Failed to send discrepancy email:', emailError);
          }
        }

        // Send received/invoice emails
        try {
          const serviceClient = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
          );

          await serviceClient.functions.invoke('send-po-lifecycle-email', {
            body: {
              po_id: data.po_id,
              notification_type: 'received',
              additional_data: {
                grn_number: grnNumber,
                has_discrepancy: hasUnderReceiving,
                received_by: userProfile?.full_name || 'Warehouse Staff'
              }
            }
          });

          // Send invoice email
          await serviceClient.functions.invoke('send-po-lifecycle-email', {
            body: {
              po_id: data.po_id,
              notification_type: 'invoice',
              additional_data: {
                grn_number: grnNumber
              }
            }
          });

          console.log('GRN emails sent successfully');
        } catch (emailError) {
          console.error('Failed to send GRN emails:', emailError);
        }

        return new Response(
          JSON.stringify({ 
            success: true, 
            grn, 
            hasDiscrepancy,
            status: grnStatus,
            message: hasUnderReceiving 
              ? 'Partial receiving completed. Inventory updated with received quantities.' 
              : 'Goods received successfully. Inventory updated.'
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'reject': {
        if (!data.grn_id || !data.rejection_reason) {
          throw new Error('Missing grn_id or rejection_reason');
        }

        // Check user role - only super_admin and super_manager can reject
        const { data: userRoles } = await supabaseClient
          .from('user_roles')
          .select('role')
          .eq('user_id', user.id)
          .in('role', ['super_admin', 'super_manager']);

        if (!userRoles || userRoles.length === 0) {
          throw new Error('Unauthorized: Only super_admin or super_manager can reject GRNs');
        }

        // Get GRN details
        const { data: grn, error: grnFetchError } = await supabaseClient
          .from('goods_received_notes')
          .select('*, purchase_orders(id, po_number), grn_items(*)')
          .eq('id', data.grn_id)
          .single();

        if (grnFetchError) throw grnFetchError;

        // Reverse inventory updates that were already made
        for (const item of grn.grn_items || []) {
          const qtyToRemove = item.quantity_accepted || item.quantity_received;
          
          if (qtyToRemove <= 0) continue;

          if (item.product_id) {
            // Reverse product inventory
            const { data: existingInv } = await supabaseClient
              .from('inventory')
              .select('id, quantity')
              .eq('product_id', item.product_id)
              .eq('outlet_id', grn.outlet_id)
              .single();

            if (existingInv) {
              await supabaseClient
                .from('inventory')
                .update({
                  quantity: Math.max(0, existingInv.quantity - qtyToRemove),
                  available_quantity: Math.max(0, existingInv.quantity - qtyToRemove)
                })
                .eq('id', existingInv.id);
            }

            // Create reversal stock movement
            await supabaseClient
              .from('stock_movements')
              .insert({
                product_id: item.product_id,
                outlet_id: grn.outlet_id,
                movement_type: 'adjustment',
                quantity: -qtyToRemove,
                created_by: user.id,
                reference_id: grn.id,
                notes: `GRN ${grn.grn_number} Rejected: ${data.rejection_reason}`
              });
          } else if (item.packaging_item_id) {
            // Reverse packaging inventory
            const { data: packagingItem } = await supabaseClient
              .from('packaging_items')
              .select('id, current_stock')
              .eq('id', item.packaging_item_id)
              .single();

            if (packagingItem) {
              await supabaseClient
                .from('packaging_items')
                .update({
                  current_stock: Math.max(0, (packagingItem.current_stock || 0) - qtyToRemove)
                })
                .eq('id', item.packaging_item_id);
            }

            // Create reversal packaging movement
            await supabaseClient
              .from('packaging_movements')
              .insert({
                packaging_item_id: item.packaging_item_id,
                movement_type: 'adjustment',
                quantity: -qtyToRemove,
                created_by: user.id,
                reference_id: grn.id,
                notes: `GRN ${grn.grn_number} Rejected: ${data.rejection_reason}`
              });
          }
        }

        // Reverse PO item received quantities
        for (const item of grn.grn_items || []) {
          if (item.po_item_id) {
            const { data: poItem } = await supabaseClient
              .from('purchase_order_items')
              .select('quantity_received')
              .eq('id', item.po_item_id)
              .single();

            if (poItem) {
              await supabaseClient
                .from('purchase_order_items')
                .update({
                  quantity_received: Math.max(0, (poItem.quantity_received || 0) - (item.quantity_received || 0))
                })
                .eq('id', item.po_item_id);
            }
          }
        }

        // Update GRN status to rejected
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

        // Update all GRN items to rejected
        await supabaseClient
          .from('grn_items')
          .update({
            quality_status: 'rejected'
          })
          .eq('grn_id', data.grn_id);

        // Reset PO status back to in_transit or confirmed
        if (grn.purchase_orders?.id) {
          await supabaseClient
            .from('purchase_orders')
            .update({
              status: 'in_transit',
              received_at: null
            })
            .eq('id', grn.purchase_orders.id);
        }

        // Notify managers
        const { data: managers } = await supabaseClient
          .from('user_roles')
          .select('user_id')
          .in('role', ['super_admin', 'super_manager', 'warehouse_manager'])
          .eq('is_active', true);

        if (managers) {
          const notifications = managers.map((m: any) => ({
            user_id: m.user_id,
            title: 'GRN Rejected',
            message: `GRN ${grn.grn_number} for PO ${grn.purchase_orders?.po_number} has been rejected. Reason: ${data.rejection_reason}. Inventory has been reversed.`,
            type: 'warning',
            priority: 'high',
            action_url: '/receiving'
          }));

          await supabaseClient.from('notifications').insert(notifications);
        }

        return new Response(
          JSON.stringify({ success: true, message: 'GRN rejected and inventory reversed' }),
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
