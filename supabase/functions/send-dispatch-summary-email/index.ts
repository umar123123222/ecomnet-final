import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import nodemailer from "npm:nodemailer@6.9.7";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.2";
import { getCompanyCurrency, formatCurrencyAmount } from "../_shared/currency.ts";
import { getLocaleSettings, getTimezoneAbbreviation } from "../_shared/locale.ts";

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
  total_cogs?: number;
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

    // Helper function to format numbers with commas
    const formatNumber = (num: number) => Math.abs(num).toLocaleString('en-US');
    
    // Get company currency for formatting
    const companyCurrency = await getCompanyCurrency(supabase);
    const formatCurrency = (num: number) => formatCurrencyAmount(num, companyCurrency);
    
    // Get locale settings for timezone
    const localeSettings = await getLocaleSettings(supabase);
    // Calculate COGS if not provided - fetch product costs from database
    let totalCogs = summaryData.total_cogs || 0;
    if (!summaryData.total_cogs && Object.keys(summaryData.product_items || {}).length > 0) {
      const productIds = Object.keys(summaryData.product_items);
      const { data: productsWithCost } = await supabase
        .from('products')
        .select('id, cost')
        .in('id', productIds);
      
      if (productsWithCost) {
        const costMap = new Map(productsWithCost.map(p => [p.id, p.cost || 0]));
        totalCogs = Object.entries(summaryData.product_items).reduce((sum, [id, item]) => {
          return sum + (Math.abs(item.total_qty) * (costMap.get(id) || 0));
        }, 0);
      }
    }

    // Generate product items table with alternating rows
    const productEntries = Object.entries(summaryData.product_items || {})
      .sort((a, b) => Math.abs(b[1].total_qty) - Math.abs(a[1].total_qty)); // Sort by qty desc
    
    const productItemsHTML = productEntries.length > 0 
      ? productEntries.map(([_, product], index) => `
        <tr style="background-color: ${index % 2 === 0 ? '#ffffff' : '#f8fafc'};">
          <td style="padding: 14px 16px; border-bottom: 1px solid #e2e8f0; font-size: 14px; color: #1e293b;">${product.name}</td>
          <td style="padding: 14px 16px; border-bottom: 1px solid #e2e8f0; font-size: 14px; color: #64748b; font-family: monospace;">${product.sku || '—'}</td>
          <td style="padding: 14px 16px; border-bottom: 1px solid #e2e8f0; text-align: right; font-size: 14px; font-weight: 600; color: #0f172a;">${formatNumber(product.total_qty)}</td>
        </tr>
      `).join('')
      : '<tr><td colspan="3" style="padding: 24px; text-align: center; color: #94a3b8; font-style: italic;">No products dispatched</td></tr>';

    // Generate packaging items table with alternating rows
    const packagingEntries = Object.entries(summaryData.packaging_items || {})
      .sort((a, b) => Math.abs(b[1].total_qty) - Math.abs(a[1].total_qty));
    
    const packagingItemsHTML = packagingEntries.length > 0
      ? packagingEntries.map(([_, packaging], index) => `
        <tr style="background-color: ${index % 2 === 0 ? '#ffffff' : '#f8fafc'};">
          <td style="padding: 14px 16px; border-bottom: 1px solid #e2e8f0; font-size: 14px; color: #1e293b;">${packaging.name}</td>
          <td style="padding: 14px 16px; border-bottom: 1px solid #e2e8f0; font-size: 14px; color: #64748b; font-family: monospace;">${packaging.sku || '—'}</td>
          <td style="padding: 14px 16px; border-bottom: 1px solid #e2e8f0; text-align: right; font-size: 14px; font-weight: 600; color: #0f172a;">${formatNumber(packaging.total_qty)}</td>
        </tr>
      `).join('')
      : '<tr><td colspan="3" style="padding: 24px; text-align: center; color: #94a3b8; font-style: italic;">No packaging used</td></tr>';

    const formattedDate = new Date(summaryData.summary_date).toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric',
      weekday: 'long'
    });

    const generatedAt = new Date().toLocaleString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
      timeZone: localeSettings.timezone
    });
    const timezoneLabel = getTimezoneAbbreviation(localeSettings.timezone);

    const emailHTML = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Daily Dispatch Summary - ${formattedDate}</title>
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #1e293b; margin: 0; padding: 0; background-color: #f1f5f9;">
          <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f1f5f9; padding: 32px 16px;">
            <tr>
              <td align="center">
                <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 680px; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -2px rgba(0, 0, 0, 0.1);">
                  
                  <!-- Header -->
                  <tr>
                    <td style="background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%); padding: 40px 32px; text-align: center;">
                      <table width="100%" cellpadding="0" cellspacing="0">
                        <tr>
                          <td style="text-align: center;">
                            <p style="margin: 0 0 12px 0; font-size: 48px;">📦</p>
                            <h1 style="margin: 0; font-size: 28px; font-weight: 700; color: #ffffff; letter-spacing: -0.5px;">Daily Dispatch Summary</h1>
                            <p style="margin: 12px 0 0 0; font-size: 16px; color: rgba(255,255,255,0.9); font-weight: 500;">${formattedDate}</p>
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>

                  <!-- Stats Cards using Table -->
                  <tr>
                    <td style="padding: 32px 24px 24px 24px;">
                      <table width="100%" cellpadding="0" cellspacing="0">
                        <tr>
                          <!-- Orders Card -->
                          <td width="33%" style="padding: 0 8px 0 0;">
                            <table width="100%" cellpadding="0" cellspacing="0" style="background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%); border-radius: 12px; border: 1px solid #bfdbfe;">
                              <tr>
                                <td style="padding: 20px; text-align: center;">
                                  <p style="margin: 0; font-size: 32px; font-weight: 800; color: #1d4ed8; letter-spacing: -1px;">${formatNumber(summaryData.order_count)}</p>
                                  <p style="margin: 8px 0 0 0; font-size: 12px; color: #3b82f6; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">Orders</p>
                                </td>
                              </tr>
                            </table>
                          </td>
                          
                          <!-- Products Card -->
                          <td width="33%" style="padding: 0 4px;">
                            <table width="100%" cellpadding="0" cellspacing="0" style="background: linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%); border-radius: 12px; border: 1px solid #a7f3d0;">
                              <tr>
                                <td style="padding: 20px; text-align: center;">
                                  <p style="margin: 0; font-size: 32px; font-weight: 800; color: #059669; letter-spacing: -1px;">${formatNumber(summaryData.unique_products)}</p>
                                  <p style="margin: 8px 0 0 0; font-size: 12px; color: #10b981; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">Products</p>
                                </td>
                              </tr>
                            </table>
                          </td>
                          
                          <!-- Units Card -->
                          <td width="33%" style="padding: 0 0 0 8px;">
                            <table width="100%" cellpadding="0" cellspacing="0" style="background: linear-gradient(135deg, #fefce8 0%, #fef3c7 100%); border-radius: 12px; border: 1px solid #fde68a;">
                              <tr>
                                <td style="padding: 20px; text-align: center;">
                                  <p style="margin: 0; font-size: 32px; font-weight: 800; color: #d97706; letter-spacing: -1px;">${formatNumber(summaryData.total_product_units)}</p>
                                  <p style="margin: 8px 0 0 0; font-size: 12px; color: #f59e0b; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">Total Units</p>
                                </td>
                              </tr>
                            </table>
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>

                  <!-- Products Table Section -->
                  <tr>
                    <td style="padding: 0 24px 24px 24px;">
                      <table width="100%" cellpadding="0" cellspacing="0" style="border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden;">
                        <!-- Table Header Title -->
                        <tr>
                          <td style="background: linear-gradient(135deg, #1e40af 0%, #3b82f6 100%); padding: 16px 20px;">
                            <table width="100%" cellpadding="0" cellspacing="0">
                              <tr>
                                <td style="color: #ffffff; font-size: 16px; font-weight: 600;">
                                  📦 Products Dispatched
                                </td>
                                <td style="color: rgba(255,255,255,0.9); font-size: 13px; text-align: right;">
                                  ${formatNumber(summaryData.unique_products)} items • ${formatNumber(summaryData.total_product_units)} units
                                </td>
                              </tr>
                            </table>
                          </td>
                        </tr>
                        
                        <!-- Table Content -->
                        <tr>
                          <td>
                            <table width="100%" cellpadding="0" cellspacing="0">
                              <thead>
                                <tr style="background-color: #f8fafc;">
                                  <th style="padding: 14px 16px; text-align: left; font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 2px solid #e2e8f0;">Product Name</th>
                                  <th style="padding: 14px 16px; text-align: left; font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 2px solid #e2e8f0;">SKU</th>
                                  <th style="padding: 14px 16px; text-align: right; font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 2px solid #e2e8f0;">Quantity</th>
                                </tr>
                              </thead>
                              <tbody>
                                ${productItemsHTML}
                              </tbody>
                              <tfoot>
                                <tr style="background: linear-gradient(135deg, #f1f5f9 0%, #e2e8f0 100%);">
                                  <td colspan="2" style="padding: 14px 16px; font-size: 14px; font-weight: 700; color: #1e293b;">Total</td>
                                  <td style="padding: 14px 16px; text-align: right; font-size: 16px; font-weight: 800; color: #1d4ed8;">${formatNumber(summaryData.total_product_units)}</td>
                                </tr>
                              </tfoot>
                            </table>
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>

                  ${packagingEntries.length > 0 ? `
                  <!-- Packaging Table Section -->
                  <tr>
                    <td style="padding: 0 24px 24px 24px;">
                      <table width="100%" cellpadding="0" cellspacing="0" style="border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden;">
                        <!-- Table Header Title -->
                        <tr>
                          <td style="background: linear-gradient(135deg, #6d28d9 0%, #8b5cf6 100%); padding: 16px 20px;">
                            <table width="100%" cellpadding="0" cellspacing="0">
                              <tr>
                                <td style="color: #ffffff; font-size: 16px; font-weight: 600;">
                                  📋 Packaging Used
                                </td>
                                <td style="color: rgba(255,255,255,0.9); font-size: 13px; text-align: right;">
                                  ${formatNumber(summaryData.unique_packaging)} items • ${formatNumber(summaryData.total_packaging_units)} units
                                </td>
                              </tr>
                            </table>
                          </td>
                        </tr>
                        
                        <!-- Table Content -->
                        <tr>
                          <td>
                            <table width="100%" cellpadding="0" cellspacing="0">
                              <thead>
                                <tr style="background-color: #f8fafc;">
                                  <th style="padding: 14px 16px; text-align: left; font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 2px solid #e2e8f0;">Packaging Item</th>
                                  <th style="padding: 14px 16px; text-align: left; font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 2px solid #e2e8f0;">SKU</th>
                                  <th style="padding: 14px 16px; text-align: right; font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 2px solid #e2e8f0;">Quantity</th>
                                </tr>
                              </thead>
                              <tbody>
                                ${packagingItemsHTML}
                              </tbody>
                              <tfoot>
                                <tr style="background: linear-gradient(135deg, #f1f5f9 0%, #e2e8f0 100%);">
                                  <td colspan="2" style="padding: 14px 16px; font-size: 14px; font-weight: 700; color: #1e293b;">Total</td>
                                  <td style="padding: 14px 16px; text-align: right; font-size: 16px; font-weight: 800; color: #6d28d9;">${formatNumber(summaryData.total_packaging_units)}</td>
                                </tr>
                              </tfoot>
                            </table>
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                  ` : ''}

                  <!-- COGS Section -->
                  ${totalCogs > 0 ? `
                  <tr>
                    <td style="padding: 0 24px 24px 24px;">
                      <table width="100%" cellpadding="0" cellspacing="0" style="background: linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%); border-radius: 12px; border: 1px solid #fecaca; overflow: hidden;">
                        <tr>
                          <td style="padding: 24px;">
                            <table width="100%" cellpadding="0" cellspacing="0">
                              <tr>
                                <td style="text-align: center;">
                                  <p style="margin: 0 0 8px 0; font-size: 13px; color: #dc2626; font-weight: 600; text-transform: uppercase; letter-spacing: 1px;">💰 Cost of Goods Sold</p>
                                  <p style="margin: 0; font-size: 36px; font-weight: 800; color: #b91c1c; letter-spacing: -1px;">${formatCurrency(totalCogs)}</p>
                                  <p style="margin: 12px 0 0 0; font-size: 12px; color: #ef4444;">Based on product cost prices × quantities dispatched</p>
                                </td>
                              </tr>
                            </table>
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                  ` : ''}

                  <!-- Footer -->
                  <tr>
                    <td style="padding: 24px 24px 32px 24px; border-top: 1px solid #e2e8f0;">
                      <table width="100%" cellpadding="0" cellspacing="0">
                        <tr>
                          <td style="text-align: center;">
                            <p style="margin: 0 0 8px 0; font-size: 13px; color: #64748b;">
                              📊 Automated report generated at ${generatedAt} ${timezoneLabel}
                            </p>
                            <p style="margin: 0; font-size: 12px; color: #94a3b8;">
                              © ${new Date().getFullYear()} ${fromName} • Inventory Management System
                            </p>
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>

                </table>
              </td>
            </tr>
          </table>
        </body>
      </html>
    `;

    // Get super admin, super manager, warehouse manager, and finance emails
    const { data: managers } = await supabase
      .from('profiles')
      .select('id, email, full_name')
      .in('role', ['super_admin', 'super_manager', 'warehouse_manager', 'finance'])
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
