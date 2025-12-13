import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import nodemailer from "npm:nodemailer@6.9.7";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface POLifecycleEmailRequest {
  po_id: string;
  notification_type: 'created' | 'approved' | 'confirmed' | 'shipped' | 'received' | 'invoice';
  additional_data?: Record<string, any>;
}

interface EmailRecipients {
  to: string[];
  cc: string[];
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { po_id, notification_type, additional_data }: POLifecycleEmailRequest = await req.json();

    console.log(`Sending PO lifecycle email: ${notification_type} for PO ${po_id}`);

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Get PO details with all related info
    const { data: po, error: poError } = await supabase
      .from('purchase_orders')
      .select(`
        *,
        suppliers(id, name, email, contact_person),
        outlets(name),
        profiles!purchase_orders_created_by_fkey(full_name, email),
        purchase_order_items(
          id,
          quantity_ordered,
          quantity_received,
          unit_price,
          total_price,
          products(name, sku),
          packaging_items(name, sku)
        )
      `)
      .eq('id', po_id)
      .single();

    if (poError || !po) {
      console.error('PO not found:', po_id, poError);
      return new Response(
        JSON.stringify({ success: false, error: 'PO not found' }),
        { status: 404, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Get SMTP configuration
    const smtpHost = Deno.env.get("SMTP_HOST");
    const smtpPort = parseInt(Deno.env.get("SMTP_PORT") || "587");
    const smtpUser = Deno.env.get("SMTP_USER");
    const smtpPassword = Deno.env.get("SMTP_PASSWORD");
    const fromEmail = Deno.env.get("SMTP_FROM_EMAIL");
    const fromName = Deno.env.get("SMTP_FROM_NAME") || "Inventory Management System";

    if (!smtpHost || !smtpUser || !smtpPassword || !fromEmail) {
      console.log("SMTP configuration incomplete, skipping email");
      return new Response(
        JSON.stringify({ success: true, message: "SMTP not configured" }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpPort === 465,
      auth: { user: smtpUser, pass: smtpPassword },
      tls: { rejectUnauthorized: false }
    });

    // Collect CC recipients: warehouse_manager, super_manager, super_admin, finance users
    const ccEmails = new Set<string>();

    // Get users by role from user_roles table
    const { data: roleUsers } = await supabase
      .from('user_roles')
      .select('user_id, role')
      .in('role', ['super_admin', 'super_manager', 'warehouse_manager', 'finance'])
      .eq('is_active', true);

    if (roleUsers && roleUsers.length > 0) {
      const userIds = roleUsers.map((r: any) => r.user_id);
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, email')
        .in('id', userIds)
        .not('email', 'is', null);

      profiles?.forEach((p: any) => {
        if (p.email) ccEmails.add(p.email);
      });
    }

    // Add PO creator to CC if available
    if (po.profiles?.email) {
      ccEmails.add(po.profiles.email);
    }

    const creatorName = po.profiles?.full_name || 'Unknown User';
    const supplierName = po.suppliers?.name || 'Supplier';
    const supplierEmail = po.suppliers?.email;
    const timestamp = new Date().toLocaleString('en-US', { dateStyle: 'full', timeStyle: 'short' });

    // Build items table HTML
    const items = po.purchase_order_items || [];
    const itemsHTML = items.map((item: any) => {
      const name = item.products?.name || item.packaging_items?.name || 'Unknown Item';
      const qty = item.quantity_ordered || 0;
      const received = item.quantity_received || 0;
      const price = item.unit_price || 0;
      const total = item.total_price || (qty * price);
      return `
        <tr>
          <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">${name}</td>
          <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: center;">${qty}</td>
          ${notification_type === 'received' || notification_type === 'invoice' ? 
            `<td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: center;">${received}</td>` : ''}
          <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: right;">PKR ${price.toLocaleString()}</td>
          <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: right; font-weight: bold;">PKR ${total.toLocaleString()}</td>
        </tr>
      `;
    }).join('');

    // Generate email based on notification type
    let subject = '';
    let headerColor = '';
    let headerIcon = '';
    let headerTitle = '';
    let bodyContent = '';

    switch (notification_type) {
      case 'created':
        subject = `📋 New Purchase Order ${po.po_number} Created`;
        headerColor = '#3b82f6';
        headerIcon = '📋';
        headerTitle = 'New Purchase Order Created';
        bodyContent = `
          <p>A new purchase order has been created and is awaiting approval.</p>
          <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid ${headerColor};">
            <h3 style="margin-top: 0; color: ${headerColor};">Order Information</h3>
            <table style="width: 100%; border-collapse: collapse;">
              <tr><td style="padding: 8px 0; color: #6b7280; width: 40%;">Created By:</td><td style="padding: 8px 0; font-weight: bold; color: ${headerColor};">${creatorName}</td></tr>
              <tr><td style="padding: 8px 0; color: #6b7280;">Created On:</td><td style="padding: 8px 0;">${timestamp}</td></tr>
              <tr><td style="padding: 8px 0; color: #6b7280;">Supplier:</td><td style="padding: 8px 0;">${supplierName}</td></tr>
              <tr><td style="padding: 8px 0; color: #6b7280;">Receiving Location:</td><td style="padding: 8px 0;">${po.outlets?.name || 'Main Warehouse'}</td></tr>
              ${po.expected_delivery_date ? `<tr><td style="padding: 8px 0; color: #6b7280;">Expected Delivery:</td><td style="padding: 8px 0;">${new Date(po.expected_delivery_date).toLocaleDateString()}</td></tr>` : ''}
            </table>
          </div>
        `;
        break;

      case 'approved':
        subject = `✅ Purchase Order ${po.po_number} Approved & Sent`;
        headerColor = '#10b981';
        headerIcon = '✅';
        headerTitle = 'Purchase Order Approved';
        bodyContent = `
          <p>This purchase order has been approved by the warehouse and sent to you for confirmation.</p>
          <div style="background: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; margin: 20px 0; border-radius: 4px;">
            <strong>📋 Action Required:</strong><br>
            Please log in to the supplier portal to review and confirm this order, or reject it with a reason.
          </div>
          <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid ${headerColor};">
            <h3 style="margin-top: 0; color: ${headerColor};">Order Details</h3>
            <table style="width: 100%; border-collapse: collapse;">
              <tr><td style="padding: 8px 0; color: #6b7280; width: 40%;">PO Number:</td><td style="padding: 8px 0; font-weight: bold;">${po.po_number}</td></tr>
              <tr><td style="padding: 8px 0; color: #6b7280;">Total Amount:</td><td style="padding: 8px 0; font-weight: bold; color: ${headerColor};">PKR ${po.total_amount?.toLocaleString()}</td></tr>
              ${po.expected_delivery_date ? `<tr><td style="padding: 8px 0; color: #6b7280;">Expected Delivery:</td><td style="padding: 8px 0;">${new Date(po.expected_delivery_date).toLocaleDateString()}</td></tr>` : ''}
            </table>
          </div>
        `;
        break;

      case 'confirmed':
        const confirmedDate = additional_data?.delivery_date || po.supplier_delivery_date;
        subject = `🤝 Purchase Order ${po.po_number} Confirmed by Supplier`;
        headerColor = '#8b5cf6';
        headerIcon = '🤝';
        headerTitle = 'Order Confirmed by Supplier';
        bodyContent = `
          <p>Great news! ${supplierName} has confirmed this purchase order.</p>
          <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid ${headerColor};">
            <h3 style="margin-top: 0; color: ${headerColor};">Confirmation Details</h3>
            <table style="width: 100%; border-collapse: collapse;">
              <tr><td style="padding: 8px 0; color: #6b7280; width: 40%;">Supplier:</td><td style="padding: 8px 0;">${supplierName}</td></tr>
              <tr><td style="padding: 8px 0; color: #6b7280;">Confirmed At:</td><td style="padding: 8px 0;">${timestamp}</td></tr>
              ${confirmedDate ? `<tr><td style="padding: 8px 0; color: #6b7280;">Estimated Delivery:</td><td style="padding: 8px 0; font-weight: bold; color: ${headerColor};">${new Date(confirmedDate).toLocaleDateString()}</td></tr>` : ''}
              ${additional_data?.notes ? `<tr><td style="padding: 8px 0; color: #6b7280;">Supplier Notes:</td><td style="padding: 8px 0;">${additional_data.notes}</td></tr>` : ''}
            </table>
          </div>
        `;
        break;

      case 'shipped':
        const shippingCost = additional_data?.shipping_cost || po.shipping_cost || 0;
        subject = `🚚 Purchase Order ${po.po_number} Shipped`;
        headerColor = '#0ea5e9';
        headerIcon = '🚚';
        headerTitle = 'Order Shipped';
        bodyContent = `
          <p>${supplierName} has shipped this order.</p>
          <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid ${headerColor};">
            <h3 style="margin-top: 0; color: ${headerColor};">Shipping Details</h3>
            <table style="width: 100%; border-collapse: collapse;">
              <tr><td style="padding: 8px 0; color: #6b7280; width: 40%;">Shipped At:</td><td style="padding: 8px 0;">${timestamp}</td></tr>
              ${additional_data?.tracking ? `<tr><td style="padding: 8px 0; color: #6b7280;">Tracking Number:</td><td style="padding: 8px 0; font-weight: bold;">${additional_data.tracking}</td></tr>` : ''}
              <tr><td style="padding: 8px 0; color: #6b7280;">Delivery Charges:</td><td style="padding: 8px 0; font-weight: bold;">PKR ${shippingCost.toLocaleString()}</td></tr>
              ${additional_data?.notes ? `<tr><td style="padding: 8px 0; color: #6b7280;">Notes:</td><td style="padding: 8px 0;">${additional_data.notes}</td></tr>` : ''}
            </table>
          </div>
          <div style="background: #dbeafe; border-left: 4px solid #3b82f6; padding: 15px; margin: 20px 0; border-radius: 4px;">
            <strong>📦 Next Step:</strong><br>
            Warehouse team should prepare for receiving and inspect items upon arrival.
          </div>
        `;
        break;

      case 'received':
        const hasDiscrepancy = additional_data?.has_discrepancy || false;
        const grnNumber = additional_data?.grn_number || 'N/A';
        subject = hasDiscrepancy 
          ? `⚠️ Purchase Order ${po.po_number} Received with Discrepancies`
          : `📦 Purchase Order ${po.po_number} Received`;
        headerColor = hasDiscrepancy ? '#f59e0b' : '#22c55e';
        headerIcon = hasDiscrepancy ? '⚠️' : '📦';
        headerTitle = hasDiscrepancy ? 'Order Received with Discrepancies' : 'Order Received';
        bodyContent = `
          <p>This purchase order has been received at the warehouse.</p>
          ${hasDiscrepancy ? `
            <div style="background: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; margin: 20px 0; border-radius: 4px;">
              <strong>⚠️ Discrepancies Detected:</strong><br>
              Some items have quantity or quality discrepancies. Please review the GRN details.
            </div>
          ` : ''}
          <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid ${headerColor};">
            <h3 style="margin-top: 0; color: ${headerColor};">Receiving Details</h3>
            <table style="width: 100%; border-collapse: collapse;">
              <tr><td style="padding: 8px 0; color: #6b7280; width: 40%;">GRN Number:</td><td style="padding: 8px 0; font-weight: bold;">${grnNumber}</td></tr>
              <tr><td style="padding: 8px 0; color: #6b7280;">Received At:</td><td style="padding: 8px 0;">${timestamp}</td></tr>
              <tr><td style="padding: 8px 0; color: #6b7280;">Received By:</td><td style="padding: 8px 0;">${additional_data?.received_by || 'Warehouse Staff'}</td></tr>
            </table>
          </div>
        `;
        break;

      case 'invoice':
        // Calculate final payable amount
        const totalReceived = items.reduce((sum: number, item: any) => {
          const received = item.quantity_received || 0;
          const price = item.unit_price || 0;
          return sum + (received * price);
        }, 0);
        const deliveryCost = po.shipping_cost || 0;
        const creditNoteAmount = additional_data?.credit_notes_total || 0;
        const netPayable = totalReceived + deliveryCost - creditNoteAmount;

        subject = `💰 Invoice for Purchase Order ${po.po_number} - Payment Due`;
        headerColor = '#7c3aed';
        headerIcon = '💰';
        headerTitle = 'Final Invoice - Payment Due';
        bodyContent = `
          <p>Please find below the final invoice for the received goods.</p>
          <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3 style="margin-top: 0; color: ${headerColor};">Received Items</h3>
            <table style="width: 100%; border-collapse: collapse;">
              <thead>
                <tr style="background: #f3f4f6;">
                  <th style="padding: 12px; text-align: left; border-bottom: 2px solid ${headerColor};">Item</th>
                  <th style="padding: 12px; text-align: center; border-bottom: 2px solid ${headerColor};">Ordered</th>
                  <th style="padding: 12px; text-align: center; border-bottom: 2px solid ${headerColor};">Received</th>
                  <th style="padding: 12px; text-align: right; border-bottom: 2px solid ${headerColor};">Unit Price</th>
                  <th style="padding: 12px; text-align: right; border-bottom: 2px solid ${headerColor};">Total</th>
                </tr>
              </thead>
              <tbody>
                ${items.map((item: any) => {
                  const name = item.products?.name || item.packaging_items?.name || 'Unknown';
                  const received = item.quantity_received || 0;
                  const price = item.unit_price || 0;
                  return `
                    <tr>
                      <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">${name}</td>
                      <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: center;">${item.quantity_ordered}</td>
                      <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: center; ${received < item.quantity_ordered ? 'color: #ef4444;' : ''}">${received}</td>
                      <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: right;">PKR ${price.toLocaleString()}</td>
                      <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: right; font-weight: bold;">PKR ${(received * price).toLocaleString()}</td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          </div>
          
          <div style="background: #f5f3ff; padding: 20px; border-radius: 8px; margin: 20px 0; border: 2px solid ${headerColor};">
            <h3 style="margin-top: 0; color: ${headerColor};">Payment Summary</h3>
            <table style="width: 100%; border-collapse: collapse;">
              <tr><td style="padding: 10px 0; color: #6b7280;">Items Subtotal:</td><td style="padding: 10px 0; text-align: right;">PKR ${totalReceived.toLocaleString()}</td></tr>
              <tr><td style="padding: 10px 0; color: #6b7280;">Shipping Charges:</td><td style="padding: 10px 0; text-align: right;">PKR ${deliveryCost.toLocaleString()}</td></tr>
              ${creditNoteAmount > 0 ? `<tr><td style="padding: 10px 0; color: #ef4444;">Credit Notes/Deductions:</td><td style="padding: 10px 0; text-align: right; color: #ef4444;">- PKR ${creditNoteAmount.toLocaleString()}</td></tr>` : ''}
              <tr style="border-top: 2px solid ${headerColor};">
                <td style="padding: 15px 0; font-size: 18px; font-weight: bold;">Net Payable:</td>
                <td style="padding: 15px 0; text-align: right; font-size: 22px; font-weight: bold; color: ${headerColor};">PKR ${netPayable.toLocaleString()}</td>
              </tr>
            </table>
          </div>
          
          <div style="background: #dcfce7; border-left: 4px solid #22c55e; padding: 15px; margin: 20px 0; border-radius: 4px;">
            <strong>💳 Payment Information:</strong><br>
            Please process the payment at your earliest convenience. Contact accounts department for payment details.
          </div>
        `;
        break;
    }

    // Build items table for non-invoice emails
    const itemsTableHTML = notification_type !== 'invoice' ? `
      <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0;">
        <h3 style="margin-top: 0; color: ${headerColor};">Order Items (${items.length})</h3>
        <table style="width: 100%; border-collapse: collapse;">
          <thead>
            <tr style="background: #f3f4f6;">
              <th style="padding: 12px; text-align: left; border-bottom: 2px solid ${headerColor};">Item</th>
              <th style="padding: 12px; text-align: center; border-bottom: 2px solid ${headerColor};">Qty</th>
              ${notification_type === 'received' ? '<th style="padding: 12px; text-align: center; border-bottom: 2px solid ' + headerColor + ';">Received</th>' : ''}
              <th style="padding: 12px; text-align: right; border-bottom: 2px solid ${headerColor};">Unit Price</th>
              <th style="padding: 12px; text-align: right; border-bottom: 2px solid ${headerColor};">Total</th>
            </tr>
          </thead>
          <tbody>${itemsHTML}</tbody>
          <tfoot>
            <tr style="background: #eff6ff;">
              <td colspan="${notification_type === 'received' ? '4' : '3'}" style="padding: 15px 12px; text-align: right; font-weight: bold;">Grand Total:</td>
              <td style="padding: 15px 12px; text-align: right; font-weight: bold; font-size: 18px; color: ${headerColor};">PKR ${po.total_amount?.toLocaleString()}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    ` : '';

    // Complete email HTML
    const emailHTML = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>${subject}</title>
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 700px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, ${headerColor} 0%, ${headerColor}dd 100%); color: white; padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
            <h1 style="margin: 0; font-size: 24px;">${headerIcon} ${headerTitle}</h1>
            <p style="margin: 10px 0 0 0; font-size: 18px; opacity: 0.9;">${po.po_number}</p>
          </div>
          
          <div style="background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px;">
            ${bodyContent}
            ${itemsTableHTML}
            
            <center style="margin: 30px 0;">
              <a href="/purchase-orders" 
                 style="display: inline-block; padding: 14px 32px; background: ${headerColor}; color: white; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 16px;">
                View Purchase Order
              </a>
            </center>

            <div style="text-align: center; color: #6b7280; font-size: 14px; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
              <p>This is an automated notification from ${fromName}.</p>
              <p>&copy; ${new Date().getFullYear()} ${fromName}. All rights reserved.</p>
            </div>
          </div>
        </body>
      </html>
    `;

    // Determine TO and CC recipients based on notification type
    const recipients: EmailRecipients = { to: [], cc: Array.from(ccEmails) };

    // TO is always supplier email (if available)
    if (supplierEmail) {
      recipients.to.push(supplierEmail);
      // Remove supplier from CC if present
      recipients.cc = recipients.cc.filter(e => e !== supplierEmail);
    }

    // If no supplier email, send to first CC as TO
    if (recipients.to.length === 0 && recipients.cc.length > 0) {
      recipients.to.push(recipients.cc.shift()!);
    }

    // Send email
    let sentCount = 0;
    if (recipients.to.length > 0) {
      try {
        await transporter.sendMail({
          from: `${fromName} <${fromEmail}>`,
          to: recipients.to.join(', '),
          cc: recipients.cc.length > 0 ? recipients.cc.join(', ') : undefined,
          subject: subject,
          html: emailHTML,
        });
        sentCount = recipients.to.length + recipients.cc.length;
        console.log(`Email sent to: ${recipients.to.join(', ')}, CC: ${recipients.cc.join(', ')}`);
      } catch (error) {
        console.error('Failed to send email:', error);
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        sent_count: sentCount,
        to: recipients.to,
        cc: recipients.cc
      }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: any) {
    console.error("Error sending PO lifecycle email:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
