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
          product_id: item.product_id || null,
          packaging_item_id: item.packaging_item_id || null,
          quantity_expected: item.quantity_expected || 0,
          quantity_received: item.quantity_received || 0,
          unit_cost: item.unit_cost || 0,
          batch_number: item.batch_number || null,
          expiry_date: item.expiry_date || null,
          notes: item.notes || null,
          quality_status: 'pending',
          defect_type: item.damage_reason || null
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

        // Get GRN items with products and packaging
        const { data: grnItems, error: itemsError } = await supabaseClient
          .from('grn_items')
          .select('*, products(*), packaging_items(*)')
          .eq('grn_id', data.grn_id);

        if (itemsError) throw itemsError;

        // Get GRN details
        const { data: grn, error: grnError } = await supabaseClient
          .from('goods_received_notes')
          .select('*, purchase_orders(id)')
          .eq('id', data.grn_id)
          .single();

        if (grnError) throw grnError;

        // Update inventory for each item
        for (const item of grnItems) {
          const qtyToAdd = item.quantity_accepted || item.quantity_received;
          
          if (item.product_id) {
            // Handle PRODUCT inventory
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
                created_by: user.id,
                reference_id: grn.id,
                notes: `GRN ${grn.grn_number}`
              });
          }

          // Update GRN item status
          await supabaseClient
            .from('grn_items')
            .update({
              quality_status: 'accepted',
              quantity_accepted: qtyToAdd
            })
            .eq('id', item.id);
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

        // Update PO status to completed and set received_at
        if (grn.purchase_orders?.id) {
          await supabaseClient
            .from('purchase_orders')
            .update({
              status: 'completed',
              received_at: new Date().toISOString()
            })
            .eq('id', grn.purchase_orders.id);
        }

        return new Response(
          JSON.stringify({ 
            success: true, 
            message: 'GRN accepted and inventory updated' 
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'resolve': {
        // For resolving discrepancies - only super_admin and super_manager
        if (!data.grn_id) {
          throw new Error('Missing grn_id');
        }

        // Check user role
        const { data: userRoles } = await supabaseClient
          .from('user_roles')
          .select('role')
          .eq('user_id', user.id)
          .in('role', ['super_admin', 'super_manager']);

        if (!userRoles || userRoles.length === 0) {
          throw new Error('Unauthorized: Only super_admin or super_manager can resolve discrepancies');
        }

        // Get GRN details
        const { data: grn, error: grnError } = await supabaseClient
          .from('goods_received_notes')
          .select('*, purchase_orders(id)')
          .eq('id', data.grn_id)
          .single();

        if (grnError) throw grnError;

        // Get GRN items
        const { data: grnItems, error: itemsError } = await supabaseClient
          .from('grn_items')
          .select('*, products(*), packaging_items(*)')
          .eq('grn_id', data.grn_id);

        if (itemsError) throw itemsError;

        // Process resolutions if provided
        const resolutions = data.resolutions || [];
        
        for (const item of grnItems) {
          const resolution = resolutions.find((r: any) => r.item_id === item.id);
          const qtyToAdd = resolution?.quantity_accepted ?? item.quantity_received;
          const qualityStatus = resolution?.quality_status || 'accepted';

          // Update GRN item with resolution
          await supabaseClient
            .from('grn_items')
            .update({
              quantity_accepted: qtyToAdd,
              quantity_rejected: resolution?.quantity_rejected || 0,
              quality_status: qualityStatus,
              notes: resolution?.resolution_notes || item.notes
            })
            .eq('id', item.id);

          // Only add to inventory if accepted or write_off (write_off still adds to inventory but is tracked)
          if (qualityStatus !== 'rejected' && qtyToAdd > 0) {
            if (item.product_id) {
              // Handle PRODUCT inventory
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
                  notes: `GRN ${grn.grn_number} - Resolved (${qualityStatus})`
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
                  created_by: user.id,
                  reference_id: grn.id,
                  notes: `GRN ${grn.grn_number} - Resolved (${qualityStatus})`
                });
            }
          }
        }

        // Update GRN status
        await supabaseClient
          .from('goods_received_notes')
          .update({
            status: 'resolved',
            inspected_by: user.id,
            inspected_at: new Date().toISOString(),
            quality_passed: true,
            notes: data.notes || grn.notes
          })
          .eq('id', data.grn_id);

        // Update PO status to completed and set received_at
        if (grn.purchase_orders?.id) {
          await supabaseClient
            .from('purchase_orders')
            .update({
              status: 'completed',
              received_at: new Date().toISOString()
            })
            .eq('id', grn.purchase_orders.id);
        }

        return new Response(
          JSON.stringify({ 
            success: true, 
            message: 'Discrepancy resolved and inventory updated' 
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'reject': {
        if (!data.grn_id || !data.rejection_reason) {
          throw new Error('Missing grn_id or rejection_reason');
        }

        // Get GRN details for PO update
        const { data: grn } = await supabaseClient
          .from('goods_received_notes')
          .select('purchase_orders(id)')
          .eq('id', data.grn_id)
          .single();

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
