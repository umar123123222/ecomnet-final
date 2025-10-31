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
    console.log('Purchase Order Operation:', action, data);

    switch (action) {
      case 'create': {
        // Validate required fields
        if (!data.supplier_id || !data.outlet_id || !data.items || data.items.length === 0) {
          throw new Error('Missing required fields: supplier_id, outlet_id, and items are required');
        }

        // Generate PO number
        const year = new Date().getFullYear();
        const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
        const poNumber = `PO-${year}-${random}`;

        // Calculate totals
        let totalAmount = 0;
        const items = data.items.map((item: any) => {
          const itemTotal = item.quantity_ordered * item.unit_price;
          const discountAmount = itemTotal * (item.discount_rate || 0) / 100;
          const taxAmount = (itemTotal - discountAmount) * (item.tax_rate || 0) / 100;
          const finalTotal = itemTotal - discountAmount + taxAmount;
          totalAmount += finalTotal;
          
          return {
            ...item,
            total_price: finalTotal
          };
        });

        // Create PO
        const { data: po, error: poError } = await supabaseClient
          .from('purchase_orders')
          .insert({
            po_number: poNumber,
            supplier_id: data.supplier_id,
            outlet_id: data.outlet_id,
            total_amount: totalAmount,
            tax_amount: data.tax_amount || 0,
            discount_amount: data.discount_amount || 0,
            shipping_cost: data.shipping_cost || 0,
            expected_delivery_date: data.expected_delivery_date,
            notes: data.notes,
            terms_conditions: data.terms_conditions,
            created_by: user.id,
            status: 'draft'
          })
          .select()
          .single();

        if (poError) throw poError;

        // Create PO items
        const poItems = items.map((item: any) => ({
          po_id: po.id,
          product_id: item.product_id,
          quantity_ordered: item.quantity_ordered,
          unit_price: item.unit_price,
          tax_rate: item.tax_rate || 0,
          discount_rate: item.discount_rate || 0,
          total_price: item.total_price,
          notes: item.notes
        }));

        const { error: itemsError } = await supabaseClient
          .from('purchase_order_items')
          .insert(poItems);

        if (itemsError) throw itemsError;

        // Get supplier and item details for notification
        const { data: supplier } = await supabaseClient
          .from('suppliers')
          .select('name, email')
          .eq('id', data.supplier_id)
          .single();

        // Send email notification to supplier and admins
        if (supplier?.email) {
          try {
            const itemDetails = await Promise.all(
              items.map(async (item: any) => {
                const { data: product } = await supabaseClient
                  .from('products')
                  .select('name')
                  .eq('id', item.product_id)
                  .single();
                
                return {
                  name: product?.name || 'Unknown Product',
                  quantity: item.quantity_ordered,
                  unit_price: item.unit_price
                };
              })
            );

            await supabaseClient.functions.invoke('send-po-notification', {
              body: {
                po_id: po.id,
                supplier_email: supplier.email,
                supplier_name: supplier.name,
                po_number: poNumber,
                total_amount: totalAmount,
                expected_delivery_date: data.expected_delivery_date,
                items: itemDetails,
                notify_admins: true
              }
            });

            console.log('PO notification sent successfully');
          } catch (emailError) {
            console.error('Failed to send PO notification:', emailError);
            // Don't fail the PO creation if email fails
          }
        }

        return new Response(
          JSON.stringify({ success: true, po, message: 'Purchase order created successfully' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'approve': {
        if (!data.po_id) {
          throw new Error('Missing po_id');
        }

        const { error } = await supabaseClient
          .from('purchase_orders')
          .update({
            status: 'sent',
            approved_by: user.id,
            approved_at: new Date().toISOString()
          })
          .eq('id', data.po_id);

        if (error) throw error;

        // TODO: Send email notification to supplier

        return new Response(
          JSON.stringify({ success: true, message: 'Purchase order approved and sent to supplier' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'cancel': {
        if (!data.po_id) {
          throw new Error('Missing po_id');
        }

        const { error } = await supabaseClient
          .from('purchase_orders')
          .update({ status: 'cancelled' })
          .eq('id', data.po_id);

        if (error) throw error;

        return new Response(
          JSON.stringify({ success: true, message: 'Purchase order cancelled' }),
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
