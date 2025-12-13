import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import nodemailer from "npm:nodemailer@6.9.7";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface StatusNotificationRequest {
  po_id: string;
  po_number: string;
  new_status: string;
  changed_by_name: string;
  additional_info?: Record<string, any>;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const {
      po_id,
      po_number,
      new_status,
      changed_by_name,
      additional_info,
    }: StatusNotificationRequest = await req.json();

    console.log(`Sending PO status notification for ${po_number} -> ${new_status}`);

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Get PO details
    const { data: po } = await supabase
      .from('purchase_orders')
      .select(`
        *,
        suppliers(name, email),
        outlets(name),
        profiles!purchase_orders_created_by_fkey(full_name, email)
      `)
      .eq('id', po_id)
      .single();

    if (!po) {
      console.error('PO not found:', po_id);
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

    // Status display configuration
    const statusConfig: Record<string, { label: string; color: string; icon: string; priority: string }> = {
      pending: { label: 'Pending Approval', color: '#f59e0b', icon: '⏳', priority: 'normal' },
      sent: { label: 'Sent to Supplier', color: '#3b82f6', icon: '📤', priority: 'normal' },
      confirmed: { label: 'Confirmed by Supplier', color: '#10b981', icon: '✅', priority: 'normal' },
      supplier_rejected: { label: 'Rejected by Supplier', color: '#ef4444', icon: '❌', priority: 'high' },
      in_transit: { label: 'In Transit', color: '#8b5cf6', icon: '🚚', priority: 'normal' },
      partially_received: { label: 'Partially Received', color: '#f97316', icon: '📦', priority: 'normal' },
      completed: { label: 'Completed', color: '#22c55e', icon: '✅', priority: 'normal' },
      cancelled: { label: 'Cancelled', color: '#6b7280', icon: '🚫', priority: 'high' },
      payment_pending: { label: 'Payment Pending', color: '#f59e0b', icon: '💰', priority: 'normal' },
      payment_partial: { label: 'Partial Payment', color: '#f97316', icon: '💵', priority: 'normal' },
      payment_paid: { label: 'Fully Paid', color: '#22c55e', icon: '💚', priority: 'normal' },
    };

    const config = statusConfig[new_status] || statusConfig.pending;
    const timestamp = new Date().toLocaleString('en-US', { 
      dateStyle: 'full', 
      timeStyle: 'short' 
    });

    // Build additional info HTML
    let additionalInfoHTML = '';
    if (additional_info) {
      const infoItems = Object.entries(additional_info)
        .filter(([key, value]) => value !== undefined && value !== null)
        .map(([key, value]) => {
          const label = key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
          return `<tr><td style="padding: 8px 0; color: #6b7280;">${label}:</td><td style="padding: 8px 0;">${value}</td></tr>`;
        })
        .join('');
      
      if (infoItems) {
        additionalInfoHTML = `
          <div style="background: #f9fafb; padding: 15px; border-radius: 8px; margin: 15px 0;">
            <h4 style="margin: 0 0 10px 0; color: #374151;">Additional Information</h4>
            <table style="width: 100%;">${infoItems}</table>
          </div>
        `;
      }
    }

    const emailHTML = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>PO Status Update - ${po_number}</title>
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: ${config.color}; color: white; padding: 25px; border-radius: 10px 10px 0 0; text-align: center;">
            <h1 style="margin: 0; font-size: 24px;">${config.icon} PO Status Update</h1>
            <p style="margin: 10px 0 0 0; font-size: 16px; opacity: 0.9;">${po_number}</p>
          </div>
          
          <div style="background: #f9fafb; padding: 25px; border-radius: 0 0 10px 10px;">
            <div style="background: white; padding: 20px; border-radius: 8px; border-left: 4px solid ${config.color};">
              <h3 style="margin: 0 0 15px 0;">Status Changed to: <span style="color: ${config.color};">${config.label}</span></h3>
              
              <table style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="padding: 8px 0; color: #6b7280; width: 40%;">PO Number:</td>
                  <td style="padding: 8px 0; font-weight: bold;">${po_number}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; color: #6b7280;">Supplier:</td>
                  <td style="padding: 8px 0;">${po.suppliers?.name || 'N/A'}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; color: #6b7280;">Total Amount:</td>
                  <td style="padding: 8px 0; font-weight: bold;">PKR ${po.total_amount?.toLocaleString() || '0'}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; color: #6b7280;">Changed By:</td>
                  <td style="padding: 8px 0;">${changed_by_name}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; color: #6b7280;">Timestamp:</td>
                  <td style="padding: 8px 0;">${timestamp}</td>
                </tr>
              </table>
            </div>
            
            ${additionalInfoHTML}
            
            <center style="margin: 25px 0;">
              <a href="/purchase-orders" 
                 style="display: inline-block; padding: 12px 28px; background: ${config.color}; color: white; text-decoration: none; border-radius: 6px; font-weight: bold;">
                View Purchase Order
              </a>
            </center>
            
            <div style="text-align: center; color: #9ca3af; font-size: 12px; margin-top: 20px; padding-top: 15px; border-top: 1px solid #e5e7eb;">
              <p>This is an automated notification from ${fromName}</p>
            </div>
          </div>
        </body>
      </html>
    `;

    // Get all super_admin and super_manager emails
    const { data: adminUsers } = await supabase
      .from('profiles')
      .select('id, email, full_name')
      .in('role', ['super_admin', 'super_manager'])
      .not('email', 'is', null);

    const recipientEmails = new Set<string>();
    
    // Add admins
    adminUsers?.forEach((u: any) => {
      if (u.email) recipientEmails.add(u.email);
    });
    
    // Add PO creator
    if (po.profiles?.email) {
      recipientEmails.add(po.profiles.email);
    }

    // Send to all recipients
    let sentCount = 0;
    for (const email of recipientEmails) {
      try {
        await transporter.sendMail({
          from: `${fromName} <${fromEmail}>`,
          to: email,
          subject: `${config.icon} PO ${po_number} - ${config.label}`,
          html: emailHTML,
        });
        sentCount++;
        console.log(`Status notification sent to ${email}`);
      } catch (error) {
        console.error(`Failed to send to ${email}:`, error);
      }
    }

    // Also notify supplier for certain statuses
    const supplierNotifyStatuses = ['sent', 'cancelled'];
    if (supplierNotifyStatuses.includes(new_status) && po.suppliers?.email) {
      try {
        await transporter.sendMail({
          from: `${fromName} <${fromEmail}>`,
          to: po.suppliers.email,
          subject: `${config.icon} Purchase Order ${po_number} - ${config.label}`,
          html: emailHTML,
        });
        console.log(`Supplier notification sent to ${po.suppliers.email}`);
      } catch (error) {
        console.error(`Failed to notify supplier:`, error);
      }
    }

    return new Response(
      JSON.stringify({ success: true, sent_count: sentCount }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: any) {
    console.error("Error sending status notification:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
