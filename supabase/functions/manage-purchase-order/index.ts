import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Helper to send status change notifications
async function sendStatusNotification(
  supabaseClient: any,
  po: any,
  newStatus: string,
  changedBy: string,
  additionalInfo?: Record<string, any>
) {
  try {
    // Get the changer's name
    const { data: changerProfile } = await supabaseClient
      .from('profiles')
      .select('full_name, email')
      .eq('id', changedBy)
      .single();
    
    const changerName = changerProfile?.full_name || changerProfile?.email || 'System';
    
    // Get all super_admin and super_manager users
    const { data: adminUsers } = await supabaseClient
      .from('user_roles')
      .select('user_id')
      .in('role', ['super_admin', 'super_manager'])
      .eq('is_active', true);
    
    const adminUserIds = adminUsers?.map((u: any) => u.user_id) || [];
    
    // Create in-app notifications for all admins
    const statusLabels: Record<string, string> = {
      pending: 'Created',
      sent: 'Sent to Supplier',
      confirmed: 'Confirmed by Supplier',
      supplier_rejected: 'Rejected by Supplier',
      in_transit: 'In Transit',
      partially_received: 'Partially Received',
      completed: 'Completed',
      cancelled: 'Cancelled'
    };
    
    const statusLabel = statusLabels[newStatus] || newStatus;
    
    const notifications = adminUserIds.map((userId: string) => ({
      user_id: userId,
      title: `PO ${po.po_number} - ${statusLabel}`,
      message: `Purchase Order ${po.po_number} status changed to "${statusLabel}" by ${changerName}`,
      type: 'purchase_order',
      priority: ['supplier_rejected', 'cancelled'].includes(newStatus) ? 'high' : 'normal',
      action_url: '/purchase-orders',
      metadata: {
        po_id: po.id,
        po_number: po.po_number,
        new_status: newStatus,
        changed_by: changedBy,
        ...additionalInfo
      }
    }));
    
    if (notifications.length > 0) {
      await supabaseClient.from('notifications').insert(notifications);
    }
    
    // Send email notification
    await supabaseClient.functions.invoke('send-po-status-notification', {
      body: {
        po_id: po.id,
        po_number: po.po_number,
        new_status: newStatus,
        changed_by_name: changerName,
        additional_info: additionalInfo
      }
    });
    
    console.log(`Status notification sent for PO ${po.po_number} -> ${newStatus}`);
  } catch (error) {
    console.error('Failed to send status notification:', error);
    // Don't throw - notification failure shouldn't break the action
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

        // Create PO with status 'pending' - supplier can immediately see and confirm/reject
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
            status: 'pending'
          })
          .select()
          .single();

        if (poError) throw poError;

        // Create PO items
        const poItems = items.map((item: any) => ({
          po_id: po.id,
          product_id: item.product_id,
          packaging_item_id: item.packaging_item_id,
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

        // Send status notification
        await sendStatusNotification(supabaseClient, po, 'pending', user.id, {
          supplier_id: data.supplier_id,
          total_amount: totalAmount
        });

        // Send PO lifecycle email (created)
        try {
          const serviceClient = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
          );

          await serviceClient.functions.invoke('send-po-lifecycle-email', {
            body: {
              po_id: po.id,
              notification_type: 'created'
            }
          });

          console.log('PO created email sent successfully');
        } catch (emailError) {
          console.error('Failed to send PO created email:', emailError);
        }

        return new Response(
          JSON.stringify({ success: true, po, message: 'Purchase order created and sent to supplier' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // REMOVED: 'approve' action - no longer needed since POs go directly to supplier

      case 'cancel': {
        if (!data.po_id) {
          throw new Error('Missing po_id');
        }

        // Get PO details first
        const { data: po, error: poFetchError } = await supabaseClient
          .from('purchase_orders')
          .select('*')
          .eq('id', data.po_id)
          .single();
        
        if (poFetchError) throw poFetchError;

        const { error } = await supabaseClient
          .from('purchase_orders')
          .update({ 
            status: 'cancelled',
            updated_at: new Date().toISOString()
          })
          .eq('id', data.po_id);

        if (error) throw error;

        // Send notification
        await sendStatusNotification(supabaseClient, po, 'cancelled', user.id, {
          reason: data.reason || 'No reason provided'
        });

        return new Response(
          JSON.stringify({ success: true, message: 'Purchase order cancelled' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'record_payment': {
        if (!data.po_id) {
          throw new Error('Missing po_id');
        }

        // Check user role - only super_admin and super_manager can record payments
        const { data: userRoles } = await supabaseClient
          .from('user_roles')
          .select('role')
          .eq('user_id', user.id)
          .in('role', ['super_admin', 'super_manager'])
          .eq('is_active', true);

        if (!userRoles || userRoles.length === 0) {
          throw new Error('Unauthorized: Only Super Admin or Super Manager can record payments');
        }

        // Get PO details
        const { data: po, error: poFetchError } = await supabaseClient
          .from('purchase_orders')
          .select('*, suppliers(name)')
          .eq('id', data.po_id)
          .single();
        
        if (poFetchError) throw poFetchError;

        // Get credit notes sum for this PO
        const { data: creditNotes } = await supabaseClient
          .from('supplier_credit_notes')
          .select('amount')
          .eq('po_id', data.po_id)
          .eq('status', 'applied');
        
        const creditTotal = creditNotes?.reduce((sum: number, cn: any) => sum + (cn.amount || 0), 0) || 0;
        const netPayable = po.total_amount - creditTotal;
        const newPaidAmount = (po.paid_amount || 0) + (data.amount || 0);
        
        // Determine payment status
        let paymentStatus = 'pending';
        if (newPaidAmount >= netPayable) {
          paymentStatus = 'paid';
        } else if (newPaidAmount > 0) {
          paymentStatus = 'partial';
        }

        const { error } = await supabaseClient
          .from('purchase_orders')
          .update({
            paid_amount: newPaidAmount,
            payment_status: paymentStatus,
            payment_date: data.payment_date || new Date().toISOString(),
            payment_reference: data.payment_reference,
            payment_notes: data.payment_notes,
            updated_at: new Date().toISOString()
          })
          .eq('id', data.po_id);

        if (error) throw error;

        // Send notification
        await sendStatusNotification(supabaseClient, po, `payment_${paymentStatus}`, user.id, {
          amount_paid: data.amount,
          total_paid: newPaidAmount,
          net_payable: netPayable,
          payment_reference: data.payment_reference
        });

        return new Response(
          JSON.stringify({ 
            success: true, 
            message: `Payment recorded. Status: ${paymentStatus}`,
            payment_status: paymentStatus,
            paid_amount: newPaidAmount,
            net_payable: netPayable
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
