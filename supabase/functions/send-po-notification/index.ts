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

    // Get SMTP configuration
    const smtpHost = Deno.env.get("SMTP_HOST");
    const smtpPort = parseInt(Deno.env.get("SMTP_PORT") || "587");
    const smtpUser = Deno.env.get("SMTP_USER");
    const smtpPassword = Deno.env.get("SMTP_PASSWORD");
    const fromEmail = Deno.env.get("SMTP_FROM_EMAIL");
    const fromName = Deno.env.get("SMTP_FROM_NAME") || "Inventory Management System";

    if (!smtpHost || !smtpUser || !smtpPassword || !fromEmail) {
      throw new Error("SMTP configuration is incomplete");
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

    // Generate items table HTML
    const itemsHTML = items.map(item => `
      <tr>
        <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">${item.name}</td>
        <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: center;">${item.quantity}</td>
        <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: right;">PKR ${item.unit_price.toFixed(2)}</td>
        <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: right; font-weight: bold;">PKR ${(item.quantity * item.unit_price).toFixed(2)}</td>
      </tr>
    `).join('');

    // Supplier email HTML
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
              </table>
            </div>

            <div style="background: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; margin: 20px 0; border-radius: 4px;">
              <strong>📋 Action Required:</strong><br>
              Please log in to the supplier portal to review and accept this purchase order.
            </div>

            <center style="margin: 30px 0;">
              <a href="${Deno.env.get('SUPABASE_URL')?.replace('.supabase.co', '.app')}/supplier-portal" 
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

    // Send to supplier
    await transporter.sendMail({
      from: `${fromName} <${fromEmail}>`,
      to: supplier_email,
      subject: `New Purchase Order ${po_number} - Action Required`,
      html: supplierHTML,
    });

    console.log(`Supplier notification sent to ${supplier_email}`);

    // Send to admins if requested
    let adminEmails: string[] = [];
    if (notify_admins) {
      const supabase = createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
      );

      // Get admin/manager emails
      const { data: adminUsers } = await supabase
        .from('profiles')
        .select('email')
        .in('role', ['super_admin', 'super_manager', 'warehouse_manager'])
        .eq('is_active', true)
        .not('email', 'is', null);

      if (adminUsers && adminUsers.length > 0) {
        adminEmails = adminUsers.map(u => u.email).filter(Boolean) as string[];

        const adminHTML = `
          <!DOCTYPE html>
          <html>
            <head>
              <meta charset="utf-8">
              <title>Purchase Order Created - ${po_number}</title>
            </head>
            <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 650px; margin: 0 auto; padding: 20px;">
              <div style="background: #10b981; color: white; padding: 20px; border-radius: 8px 8px 0 0; text-align: center;">
                <h2 style="margin: 0;">Purchase Order Created</h2>
              </div>
              
              <div style="background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px;">
                <p>A new purchase order <strong>${po_number}</strong> has been created.</p>
                
                <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0;">
                  <table style="width: 100%;">
                    <tr>
                      <td style="padding: 8px 0;"><strong>Supplier:</strong></td>
                      <td style="padding: 8px 0;">${supplier_name}</td>
                    </tr>
                    <tr>
                      <td style="padding: 8px 0;"><strong>PO Number:</strong></td>
                      <td style="padding: 8px 0;">${po_number}</td>
                    </tr>
                    <tr>
                      <td style="padding: 8px 0;"><strong>Total Amount:</strong></td>
                      <td style="padding: 8px 0; font-weight: bold; color: #10b981;">PKR ${total_amount.toFixed(2)}</td>
                    </tr>
                    <tr>
                      <td style="padding: 8px 0;"><strong>Items:</strong></td>
                      <td style="padding: 8px 0;">${items.length} item(s)</td>
                    </tr>
                  </table>
                </div>

                <p style="font-size: 14px; color: #6b7280; margin-top: 30px; text-align: center;">
                  This is an automated notification from the Inventory Management System.
                </p>
              </div>
            </body>
          </html>
        `;

        for (const adminEmail of adminEmails) {
          try {
            await transporter.sendMail({
              from: `${fromName} <${fromEmail}>`,
              to: adminEmail,
              subject: `PO ${po_number} Created - ${supplier_name}`,
              html: adminHTML,
            });
          } catch (error) {
            console.error(`Failed to send to admin ${adminEmail}:`, error);
          }
        }

        console.log(`Admin notifications sent to ${adminEmails.length} recipients`);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: "PO notifications sent successfully",
        supplier_notified: true,
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
