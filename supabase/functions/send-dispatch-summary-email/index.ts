import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import nodemailer from "npm:nodemailer@6.9.7";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface DispatchSummaryEmailRequest {
  summary_date: string;
  product_items: Record<string, { name: string; sku: string; total_qty: number }>;
  packaging_items: Record<string, { name: string; sku: string; total_qty: number }>;
  total_product_units: number;
  total_packaging_units: number;
  unique_products: number;
  unique_packaging: number;
  order_count: number;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const summaryData: DispatchSummaryEmailRequest = await req.json();

    console.log(`Sending dispatch summary email for ${summaryData.summary_date}`);

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

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

    // Generate product items table
    const productEntries = Object.entries(summaryData.product_items || {});
    const productItemsHTML = productEntries.length > 0 
      ? productEntries.map(([_, product]) => `
        <tr>
          <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">${product.name}</td>
          <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">${product.sku || '-'}</td>
          <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: right; font-weight: bold; color: #dc2626;">-${product.total_qty}</td>
        </tr>
      `).join('')
      : '<tr><td colspan="3" style="padding: 12px; text-align: center; color: #6b7280;">No product dispatches</td></tr>';

    // Generate packaging items table
    const packagingEntries = Object.entries(summaryData.packaging_items || {});
    const packagingItemsHTML = packagingEntries.length > 0
      ? packagingEntries.map(([_, packaging]) => `
        <tr>
          <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">${packaging.name}</td>
          <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">${packaging.sku || '-'}</td>
          <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: right; font-weight: bold; color: #dc2626;">-${packaging.total_qty}</td>
        </tr>
      `).join('')
      : '<tr><td colspan="3" style="padding: 12px; text-align: center; color: #6b7280;">No packaging dispatches</td></tr>';

    const formattedDate = new Date(summaryData.summary_date).toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric',
      weekday: 'long'
    });

    const emailHTML = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Daily Dispatch Summary - ${formattedDate}</title>
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 700px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%); color: white; padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
            <h1 style="margin: 0;">📦 Daily Dispatch Summary</h1>
            <p style="margin: 10px 0 0 0; font-size: 18px; opacity: 0.9;">${formattedDate}</p>
          </div>
          
          <div style="background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px;">
            <!-- Summary Stats -->
            <div style="display: flex; gap: 15px; margin-bottom: 25px;">
              <div style="flex: 1; background: white; padding: 20px; border-radius: 8px; text-align: center; border-left: 4px solid #3b82f6;">
                <p style="margin: 0; font-size: 28px; font-weight: bold; color: #1d4ed8;">${summaryData.order_count}</p>
                <p style="margin: 5px 0 0 0; color: #6b7280; font-size: 14px;">Orders Dispatched</p>
              </div>
              <div style="flex: 1; background: white; padding: 20px; border-radius: 8px; text-align: center; border-left: 4px solid #10b981;">
                <p style="margin: 0; font-size: 28px; font-weight: bold; color: #059669;">${summaryData.unique_products}</p>
                <p style="margin: 5px 0 0 0; color: #6b7280; font-size: 14px;">Unique Products</p>
              </div>
              <div style="flex: 1; background: white; padding: 20px; border-radius: 8px; text-align: center; border-left: 4px solid #f59e0b;">
                <p style="margin: 0; font-size: 28px; font-weight: bold; color: #d97706;">${summaryData.total_product_units}</p>
                <p style="margin: 5px 0 0 0; color: #6b7280; font-size: 14px;">Total Units</p>
              </div>
            </div>

            <!-- Products Table -->
            <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <h3 style="margin-top: 0; color: #1d4ed8; display: flex; align-items: center; gap: 8px;">
                📦 Products Dispatched (${summaryData.unique_products} items, ${summaryData.total_product_units} units)
              </h3>
              <table style="width: 100%; border-collapse: collapse;">
                <thead>
                  <tr style="background: #f3f4f6;">
                    <th style="padding: 12px; text-align: left; border-bottom: 2px solid #3b82f6;">Product</th>
                    <th style="padding: 12px; text-align: left; border-bottom: 2px solid #3b82f6;">SKU</th>
                    <th style="padding: 12px; text-align: right; border-bottom: 2px solid #3b82f6;">Qty</th>
                  </tr>
                </thead>
                <tbody>
                  ${productItemsHTML}
                </tbody>
              </table>
            </div>

            <!-- Packaging Table -->
            <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <h3 style="margin-top: 0; color: #7c3aed; display: flex; align-items: center; gap: 8px;">
                📋 Packaging Used (${summaryData.unique_packaging} items, ${summaryData.total_packaging_units} units)
              </h3>
              <table style="width: 100%; border-collapse: collapse;">
                <thead>
                  <tr style="background: #f3f4f6;">
                    <th style="padding: 12px; text-align: left; border-bottom: 2px solid #7c3aed;">Packaging</th>
                    <th style="padding: 12px; text-align: left; border-bottom: 2px solid #7c3aed;">SKU</th>
                    <th style="padding: 12px; text-align: right; border-bottom: 2px solid #7c3aed;">Qty</th>
                  </tr>
                </thead>
                <tbody>
                  ${packagingItemsHTML}
                </tbody>
              </table>
            </div>

            <div style="text-align: center; color: #6b7280; font-size: 14px; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
              <p>This is an automated dispatch summary report from the Inventory Management System.</p>
              <p>&copy; ${new Date().getFullYear()} ${fromName}. All rights reserved.</p>
            </div>
          </div>
        </body>
      </html>
    `;

    // Get super admin, super manager, and warehouse manager emails
    const { data: managers } = await supabase
      .from('profiles')
      .select('id, email, full_name')
      .in('role', ['super_admin', 'super_manager', 'warehouse_manager'])
      .not('email', 'is', null);

    const recipientEmails = managers?.map(m => m.email).filter(Boolean) || [];

    if (recipientEmails.length === 0) {
      console.log('No manager emails found to send dispatch summary');
      return new Response(
        JSON.stringify({
          success: true,
          message: "No recipients found",
          emails_sent: 0,
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    let emailsSent = 0;
    for (const email of recipientEmails) {
      try {
        await transporter.sendMail({
          from: `${fromName} <${fromEmail}>`,
          to: email,
          subject: `📦 Dispatch Summary: ${formattedDate} - ${summaryData.order_count} Orders, ${summaryData.total_product_units} Units`,
          html: emailHTML,
        });
        emailsSent++;
        console.log(`Dispatch summary sent to ${email}`);
      } catch (error) {
        console.error(`Failed to send to ${email}:`, error);
      }
    }

    console.log(`Dispatch summary emails sent to ${emailsSent} recipients`);

    return new Response(
      JSON.stringify({
        success: true,
        message: "Dispatch summary emails sent successfully",
        emails_sent: emailsSent,
        recipients: recipientEmails,
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
    console.error("Error sending dispatch summary email:", error);
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
