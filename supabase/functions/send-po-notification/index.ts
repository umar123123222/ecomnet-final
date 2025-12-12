import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import nodemailer from "npm:nodemailer@6.9.7";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface PONotificationRequest {
  po_id: string;
  supplier_email: string;
  supplier_name: string;
  po_number: string;
  total_amount: number;
  expected_delivery_date: string | null;
  items: Array<{
    name: string;
    quantity: number;
    unit_price: number;
  }>;
  notify_admins: boolean;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const {
      po_id,
      supplier_email,
      supplier_name,
      po_number,
      total_amount,
      expected_delivery_date,
      items,
      notify_admins,
    }: PONotificationRequest = await req.json();

    console.log(`Sending PO notification for ${po_number} to ${supplier_email}`);

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Fetch PO details to get creator info
    const { data: poDetails } = await supabase
      .from('purchase_orders')
      .select(`
        created_by,
        order_date,
        outlets(name)
      `)
      .eq('id', po_id)
      .single();

    // Fetch creator details
    let creatorName = 'Unknown User';
    let creatorEmail = '';
    if (poDetails?.created_by) {
      const { data: creator } = await supabase
        .from('profiles')
        .select('full_name, email')
        .eq('id', poDetails.created_by)
        .single();
      if (creator) {
        creatorName = creator.full_name || 'Unknown User';
        creatorEmail = creator.email || '';
      }
    }

    const orderDate = poDetails?.order_date 
      ? new Date(poDetails.order_date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })
      : new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    
    const receivingLocation = poDetails?.outlets?.name || 'Main Warehouse';

    // Get SMTP configuration
    const smtpHost = Deno.env.get("SMTP_HOST");
    const smtpPort = parseInt(Deno.env.get("SMTP_PORT") || "587");
    const smtpUser = Deno.env.get("SMTP_USER");
    const smtpPassword = Deno.env.get("SMTP_PASSWORD");
    const fromEmail = Deno.env.get("SMTP_FROM_EMAIL");
    const fromName = Deno.env.get("SMTP_FROM_NAME") || "Inventory Management System";

    if (!smtpHost || !smtpUser || !smtpPassword || !fromEmail) {
      console.log("SMTP configuration is incomplete, skipping email notifications");
      return new Response(
        JSON.stringify({
          success: true,
          message: "SMTP not configured, emails skipped",
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpPort === 465,
      auth: {
        user: smtpUser,
        pass: smtpPassword,
      },
      tls: {
        rejectUnauthorized: false
      }
    });

    // Generate items table HTML with totals
    const itemsHTML = items.map(item => `
      <tr>
        <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">${item.name}</td>
        <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: center;">${item.quantity}</td>
        <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: right;">PKR ${item.unit_price.toFixed(2)}</td>
        <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: right; font-weight: bold;">PKR ${(item.quantity * item.unit_price).toFixed(2)}</td>
      </tr>
    `).join('');

    // Admin/Internal notification HTML (includes creator info)
    const adminHTML = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Purchase Order Created - ${po_number}</title>
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 700px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%); color: white; padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
            <h1 style="margin: 0;">📋 New Purchase Order Created</h1>
            <p style="margin: 10px 0 0 0; font-size: 18px; opacity: 0.9;">${po_number}</p>
          </div>
          
          <div style="background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px;">
            <div style="background: white; padding: 20px; border-radius: 8px; margin: 0 0 20px 0; border-left: 4px solid #3b82f6;">
              <h3 style="margin-top: 0; color: #1d4ed8;">Order Information</h3>
              <table style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="padding: 8px 0; color: #6b7280; width: 40%;"><strong>Created By:</strong></td>
                  <td style="padding: 8px 0; font-weight: bold; color: #1d4ed8;">${creatorName}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; color: #6b7280;"><strong>Created On:</strong></td>
                  <td style="padding: 8px 0;">${orderDate}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; color: #6b7280;"><strong>Supplier:</strong></td>
                  <td style="padding: 8px 0;">${supplier_name}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; color: #6b7280;"><strong>Receiving Location:</strong></td>
                  <td style="padding: 8px 0;">${receivingLocation}</td>
                </tr>
                ${expected_delivery_date ? `
                <tr>
                  <td style="padding: 8px 0; color: #6b7280;"><strong>Expected Delivery:</strong></td>
                  <td style="padding: 8px 0;">${new Date(expected_delivery_date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</td>
                </tr>
                ` : ''}
              </table>
            </div>

            <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <h3 style="margin-top: 0; color: #1d4ed8;">Order Items (${items.length})</h3>
              <table style="width: 100%; border-collapse: collapse;">
                <thead>
                  <tr style="background: #f3f4f6;">
                    <th style="padding: 12px; text-align: left; border-bottom: 2px solid #3b82f6;">Item</th>
                    <th style="padding: 12px; text-align: center; border-bottom: 2px solid #3b82f6;">Qty</th>
                    <th style="padding: 12px; text-align: right; border-bottom: 2px solid #3b82f6;">Unit Price</th>
                    <th style="padding: 12px; text-align: right; border-bottom: 2px solid #3b82f6;">Total</th>
                  </tr>
                </thead>
                <tbody>
                  ${itemsHTML}
                </tbody>
                <tfoot>
                  <tr style="background: #eff6ff;">
                    <td colspan="3" style="padding: 15px 12px; text-align: right; font-weight: bold; font-size: 16px;">Grand Total:</td>
                    <td style="padding: 15px 12px; text-align: right; font-weight: bold; font-size: 18px; color: #1d4ed8;">PKR ${total_amount.toFixed(2)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>

            <center style="margin: 30px 0;">
              <a href="/purchase-orders" 
                 style="display: inline-block; padding: 14px 32px; background: #3b82f6; color: white; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 16px;">
                View Purchase Order
              </a>
            </center>

            <div style="text-align: center; color: #6b7280; font-size: 14px; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
              <p>This is an automated notification from the Inventory Management System.</p>
              <p>&copy; ${new Date().getFullYear()} ${fromName}. All rights reserved.</p>
            </div>
          </div>
        </body>
      </html>
    `;

    // Supplier email HTML (different styling)
    const supplierHTML = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>New Purchase Order - ${po_number}</title>
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 650px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
            <h1 style="margin: 0;">New Purchase Order</h1>
            <p style="margin: 10px 0 0 0; font-size: 18px;">${po_number}</p>
          </div>
          
          <div style="background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px;">
            <p><strong>Dear ${supplier_name},</strong></p>
            
            <p>We are pleased to inform you that a new purchase order has been created for your review.</p>
            
            <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #667eea;">
              <h3 style="margin-top: 0; color: #667eea;">Order Details</h3>
              <table style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="padding: 8px 0;"><strong>PO Number:</strong></td>
                  <td style="padding: 8px 0;">${po_number}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0;"><strong>Total Amount:</strong></td>
                  <td style="padding: 8px 0; font-size: 18px; color: #667eea; font-weight: bold;">PKR ${total_amount.toFixed(2)}</td>
                </tr>
                ${expected_delivery_date ? `
                <tr>
                  <td style="padding: 8px 0;"><strong>Expected Delivery:</strong></td>
                  <td style="padding: 8px 0;">${new Date(expected_delivery_date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</td>
                </tr>
                ` : ''}
              </table>
            </div>

            <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <h3 style="margin-top: 0; color: #667eea;">Order Items</h3>
              <table style="width: 100%; border-collapse: collapse;">
                <thead>
                  <tr style="background: #f3f4f6;">
                    <th style="padding: 12px; text-align: left; border-bottom: 2px solid #667eea;">Item</th>
                    <th style="padding: 12px; text-align: center; border-bottom: 2px solid #667eea;">Quantity</th>
                    <th style="padding: 12px; text-align: right; border-bottom: 2px solid #667eea;">Unit Price</th>
                    <th style="padding: 12px; text-align: right; border-bottom: 2px solid #667eea;">Total</th>
                  </tr>
                </thead>
                <tbody>
                  ${itemsHTML}
                </tbody>
                <tfoot>
                  <tr style="background: #f5f3ff;">
                    <td colspan="3" style="padding: 15px 12px; text-align: right; font-weight: bold;">Grand Total:</td>
                    <td style="padding: 15px 12px; text-align: right; font-weight: bold; font-size: 18px; color: #667eea;">PKR ${total_amount.toFixed(2)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>

            <div style="background: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; margin: 20px 0; border-radius: 4px;">
              <strong>📋 Action Required:</strong><br>
              Please log in to the supplier portal to review and accept this purchase order.
            </div>

            <center style="margin: 30px 0;">
              <a href="/supplier-portal" 
                 style="display: inline-block; padding: 14px 32px; background: #667eea; color: white; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 16px;">
                View Purchase Order
              </a>
            </center>

            <p>If you have any questions or concerns, please contact us immediately.</p>

            <div style="text-align: center; color: #6b7280; font-size: 14px; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
              <p>This is an automated notification. Please do not reply to this email.</p>
              <p>&copy; ${new Date().getFullYear()} ${fromName}. All rights reserved.</p>
            </div>
          </div>
        </body>
      </html>
    `;

    let supplierNotified = false;
    let adminEmails: string[] = [];

    // Send to supplier if email provided
    if (supplier_email) {
      try {
        await transporter.sendMail({
          from: `${fromName} <${fromEmail}>`,
          to: supplier_email,
          subject: `New Purchase Order ${po_number} - Action Required`,
          html: supplierHTML,
        });
        supplierNotified = true;
        console.log(`Supplier notification sent to ${supplier_email}`);
      } catch (error) {
        console.error(`Failed to send to supplier ${supplier_email}:`, error);
      }
    }

    // Send to admins and creator if requested
    if (notify_admins) {
      // Get admin/manager emails
      const { data: adminUsers } = await supabase
        .from('profiles')
        .select('id, email, full_name')
        .in('role', ['super_admin', 'super_manager', 'warehouse_manager'])
        .not('email', 'is', null);

      // Build recipient list (including creator)
      const recipientMap = new Map<string, string>();
      
      // Add creator
      if (creatorEmail && poDetails?.created_by) {
        recipientMap.set(poDetails.created_by, creatorEmail);
      }
      
      // Add admins/managers
      if (adminUsers) {
        adminUsers.forEach((u: any) => {
          if (u.email) {
            recipientMap.set(u.id, u.email);
          }
        });
      }

      adminEmails = Array.from(recipientMap.values());

      for (const email of adminEmails) {
        try {
          await transporter.sendMail({
            from: `${fromName} <${fromEmail}>`,
            to: email,
            subject: `📋 PO ${po_number} Created by ${creatorName} - ${supplier_name}`,
            html: adminHTML,
          });
          console.log(`Admin notification sent to ${email}`);
        } catch (error) {
          console.error(`Failed to send to admin ${email}:`, error);
        }
      }

      console.log(`Admin notifications sent to ${adminEmails.length} recipients`);
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: "PO notifications sent successfully",
        supplier_notified: supplierNotified,
        admins_notified: adminEmails.length > 0,
        admin_count: adminEmails.length,
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders,
        },
      }
    );
  } catch (error: any) {
    console.error("Error sending PO notification:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
      }),
      {
        status: 500,
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders,
        },
      }
    );
  }
};

serve(handler);
