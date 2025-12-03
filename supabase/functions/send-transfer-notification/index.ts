import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface TransferNotificationRequest {
  transfer_id: string
  notification_type: 'created' | 'approved' | 'rejected' | 'dispatched' | 'received' | 'variance'
  additional_data?: Record<string, any>
}

interface TransferDetails {
  id: string
  status: string
  notes: string
  from_outlet: { id: string; name: string }
  to_outlet: { id: string; name: string }
  requested_by: string
  requester: { id: string; email: string; full_name: string }
  items: Array<{ product: { name: string; sku: string }; quantity_requested: number; quantity_approved?: number }>
  packaging_items?: Array<{ packaging: { name: string; sku: string }; quantity_requested: number; quantity_approved?: number }>
}

interface Recipient {
  id: string
  email: string
  full_name: string
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { transfer_id, notification_type, additional_data }: TransferNotificationRequest = await req.json()
    console.log(`Sending transfer notification: ${notification_type} for transfer ${transfer_id}`)

    // Fetch transfer details
    const { data: transfer, error: transferError } = await supabaseClient
      .from('stock_transfer_requests')
      .select(`
        id, status, notes, requested_by,
        from_outlet:outlets!stock_transfer_requests_from_outlet_id_fkey(id, name),
        to_outlet:outlets!stock_transfer_requests_to_outlet_id_fkey(id, name),
        items:stock_transfer_items(
          quantity_requested, quantity_approved,
          product:products(name, sku)
        ),
        packaging_items:stock_transfer_packaging_items(
          quantity_requested, quantity_approved,
          packaging:packaging_items(name, sku)
        )
      `)
      .eq('id', transfer_id)
      .single()

    if (transferError || !transfer) {
      console.error('Error fetching transfer:', transferError)
      return new Response(
        JSON.stringify({ error: 'Transfer not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Fetch requester details
    const { data: requester } = await supabaseClient
      .from('profiles')
      .select('id, email, full_name')
      .eq('id', transfer.requested_by)
      .single()

    // Fetch recipients (super_admin, super_manager, warehouse_manager)
    const { data: managers } = await supabaseClient
      .from('profiles')
      .select('id, email, full_name')
      .in('role', ['super_admin', 'super_manager', 'warehouse_manager'])

    // Combine and deduplicate recipients
    const recipientMap = new Map<string, Recipient>()
    if (requester) {
      recipientMap.set(requester.id, requester)
    }
    if (managers) {
      managers.forEach((m: Recipient) => recipientMap.set(m.id, m))
    }
    const recipients = Array.from(recipientMap.values()).filter(r => r.email)

    if (recipients.length === 0) {
      console.log('No recipients found for notification')
      return new Response(
        JSON.stringify({ success: true, message: 'No recipients to notify' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Generate email content based on notification type
    const emailContent = generateEmailContent(notification_type, transfer, requester, additional_data)

    // Send emails using SMTP
    const smtpHost = Deno.env.get('SMTP_HOST')
    const smtpUser = Deno.env.get('SMTP_USER')
    const smtpPassword = Deno.env.get('SMTP_PASSWORD')
    const smtpPort = parseInt(Deno.env.get('SMTP_PORT') || '587')
    const fromEmail = Deno.env.get('SMTP_FROM_EMAIL') || 'noreply@example.com'
    const fromName = Deno.env.get('SMTP_FROM_NAME') || 'Inventory System'

    if (!smtpHost || !smtpUser || !smtpPassword) {
      console.log('SMTP not configured, skipping email sending')
      return new Response(
        JSON.stringify({ success: true, message: 'SMTP not configured, emails skipped' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const client = new SMTPClient({
      connection: {
        hostname: smtpHost,
        port: smtpPort,
        tls: smtpPort === 465,
        auth: {
          username: smtpUser,
          password: smtpPassword,
        },
      },
    })

    let emailsSent = 0
    let emailsFailed = 0

    for (const recipient of recipients) {
      try {
        await client.send({
          from: `${fromName} <${fromEmail}>`,
          to: recipient.email,
          subject: emailContent.subject,
          content: emailContent.text,
          html: emailContent.html,
        })
        emailsSent++
        console.log(`Email sent to ${recipient.email}`)
      } catch (emailError) {
        console.error(`Failed to send email to ${recipient.email}:`, emailError)
        emailsFailed++
      }
    }

    await client.close()

    console.log(`Transfer notification complete: ${emailsSent} sent, ${emailsFailed} failed`)

    return new Response(
      JSON.stringify({ 
        success: true, 
        emailsSent,
        emailsFailed,
        recipients: recipients.length
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Send transfer notification error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

function generateEmailContent(
  type: string, 
  transfer: any, 
  requester: Recipient | null,
  additionalData?: Record<string, any>
): { subject: string; text: string; html: string } {
  const fromOutlet = transfer.from_outlet?.name || 'Warehouse'
  const toOutlet = transfer.to_outlet?.name || 'Unknown Store'
  const requesterName = requester?.full_name || 'Unknown User'
  const itemCount = transfer.items?.length || 0
  const packagingCount = transfer.packaging_items?.length || 0

  const itemsListHtml = transfer.items?.map((item: any) => 
    `<li>${item.product?.name || 'Unknown'} (${item.product?.sku || 'N/A'}) - Qty: ${item.quantity_approved || item.quantity_requested}</li>`
  ).join('') || '<li>No items</li>'

  const packagingListHtml = transfer.packaging_items?.map((item: any) =>
    `<li>${item.packaging?.name || 'Unknown'} (${item.packaging?.sku || 'N/A'}) - Qty: ${item.quantity_approved || item.quantity_requested}</li>`
  ).join('') || ''

  const baseUrl = 'https://lzitfcigdjbpymvebipp.supabase.co'
  const actionUrl = `/stock-transfer`

  switch (type) {
    case 'created':
      return {
        subject: `📦 New Stock Transfer Request - ${toOutlet}`,
        text: `A new stock transfer request has been created.\n\nFrom: ${fromOutlet}\nTo: ${toOutlet}\nRequested By: ${requesterName}\nItems: ${itemCount}\n\nPlease review and approve/reject this request.`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background: linear-gradient(135deg, #3b82f6, #1d4ed8); color: white; padding: 20px; border-radius: 8px 8px 0 0;">
              <h1 style="margin: 0; font-size: 24px;">📦 New Stock Transfer Request</h1>
            </div>
            <div style="background: #f8fafc; padding: 20px; border: 1px solid #e2e8f0; border-top: none;">
              <p>A new stock transfer request has been created and requires your attention.</p>
              
              <div style="background: white; padding: 15px; border-radius: 8px; margin: 15px 0;">
                <h3 style="margin-top: 0; color: #1e40af;">Transfer Details</h3>
                <p><strong>From:</strong> ${fromOutlet}</p>
                <p><strong>To:</strong> ${toOutlet}</p>
                <p><strong>Requested By:</strong> ${requesterName}</p>
                ${transfer.notes ? `<p><strong>Notes:</strong> ${transfer.notes}</p>` : ''}
              </div>

              <div style="background: white; padding: 15px; border-radius: 8px; margin: 15px 0;">
                <h3 style="margin-top: 0; color: #1e40af;">Items Requested (${itemCount})</h3>
                <ul style="padding-left: 20px;">${itemsListHtml}</ul>
                ${packagingCount > 0 ? `<h4 style="color: #1e40af;">Packaging (${packagingCount})</h4><ul style="padding-left: 20px;">${packagingListHtml}</ul>` : ''}
              </div>

              <a href="${actionUrl}" style="display: inline-block; background: #3b82f6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin-top: 10px;">Review Request</a>
            </div>
            <div style="background: #1e293b; color: #94a3b8; padding: 15px; border-radius: 0 0 8px 8px; text-align: center; font-size: 12px;">
              <p style="margin: 0;">This is an automated notification from your Inventory Management System</p>
            </div>
          </div>
        `
      }

    case 'approved':
      return {
        subject: `✅ Stock Transfer Approved - ${toOutlet}`,
        text: `The stock transfer request to ${toOutlet} has been approved.\n\nFrom: ${fromOutlet}\nTo: ${toOutlet}\nItems: ${itemCount}\n\nThe transfer is ready for dispatch.`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background: linear-gradient(135deg, #22c55e, #16a34a); color: white; padding: 20px; border-radius: 8px 8px 0 0;">
              <h1 style="margin: 0; font-size: 24px;">✅ Stock Transfer Approved</h1>
            </div>
            <div style="background: #f8fafc; padding: 20px; border: 1px solid #e2e8f0; border-top: none;">
              <p>Great news! The stock transfer request has been approved and is ready for dispatch.</p>
              
              <div style="background: white; padding: 15px; border-radius: 8px; margin: 15px 0;">
                <h3 style="margin-top: 0; color: #166534;">Transfer Details</h3>
                <p><strong>From:</strong> ${fromOutlet}</p>
                <p><strong>To:</strong> ${toOutlet}</p>
                <p><strong>Originally Requested By:</strong> ${requesterName}</p>
              </div>

              <div style="background: white; padding: 15px; border-radius: 8px; margin: 15px 0;">
                <h3 style="margin-top: 0; color: #166534;">Approved Items (${itemCount})</h3>
                <ul style="padding-left: 20px;">${itemsListHtml}</ul>
                ${packagingCount > 0 ? `<h4 style="color: #166534;">Packaging (${packagingCount})</h4><ul style="padding-left: 20px;">${packagingListHtml}</ul>` : ''}
              </div>

              <a href="${actionUrl}" style="display: inline-block; background: #22c55e; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin-top: 10px;">View Transfer</a>
            </div>
            <div style="background: #1e293b; color: #94a3b8; padding: 15px; border-radius: 0 0 8px 8px; text-align: center; font-size: 12px;">
              <p style="margin: 0;">This is an automated notification from your Inventory Management System</p>
            </div>
          </div>
        `
      }

    case 'rejected':
      const rejectionReason = additionalData?.rejection_reason || transfer.notes || 'No reason provided'
      return {
        subject: `❌ Stock Transfer Rejected - ${toOutlet}`,
        text: `The stock transfer request to ${toOutlet} has been rejected.\n\nReason: ${rejectionReason}\n\nFrom: ${fromOutlet}\nTo: ${toOutlet}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background: linear-gradient(135deg, #ef4444, #dc2626); color: white; padding: 20px; border-radius: 8px 8px 0 0;">
              <h1 style="margin: 0; font-size: 24px;">❌ Stock Transfer Rejected</h1>
            </div>
            <div style="background: #f8fafc; padding: 20px; border: 1px solid #e2e8f0; border-top: none;">
              <p>Unfortunately, the stock transfer request has been rejected.</p>
              
              <div style="background: #fef2f2; padding: 15px; border-radius: 8px; margin: 15px 0; border-left: 4px solid #ef4444;">
                <h3 style="margin-top: 0; color: #991b1b;">Rejection Reason</h3>
                <p style="margin-bottom: 0;">${rejectionReason}</p>
              </div>

              <div style="background: white; padding: 15px; border-radius: 8px; margin: 15px 0;">
                <h3 style="margin-top: 0; color: #991b1b;">Transfer Details</h3>
                <p><strong>From:</strong> ${fromOutlet}</p>
                <p><strong>To:</strong> ${toOutlet}</p>
                <p><strong>Originally Requested By:</strong> ${requesterName}</p>
              </div>

              <a href="${actionUrl}" style="display: inline-block; background: #6b7280; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin-top: 10px;">View Details</a>
            </div>
            <div style="background: #1e293b; color: #94a3b8; padding: 15px; border-radius: 0 0 8px 8px; text-align: center; font-size: 12px;">
              <p style="margin: 0;">This is an automated notification from your Inventory Management System</p>
            </div>
          </div>
        `
      }

    case 'dispatched':
      return {
        subject: `🚚 Stock Transfer Dispatched - ${toOutlet}`,
        text: `Inventory has been dispatched!\n\nFrom: ${fromOutlet}\nTo: ${toOutlet}\nItems: ${itemCount}\n\nThe items are on their way. Please be ready to receive.`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background: linear-gradient(135deg, #8b5cf6, #7c3aed); color: white; padding: 20px; border-radius: 8px 8px 0 0;">
              <h1 style="margin: 0; font-size: 24px;">🚚 Stock Transfer Dispatched</h1>
            </div>
            <div style="background: #f8fafc; padding: 20px; border: 1px solid #e2e8f0; border-top: none;">
              <p>The inventory has been dispatched and is on its way!</p>
              
              <div style="background: white; padding: 15px; border-radius: 8px; margin: 15px 0;">
                <h3 style="margin-top: 0; color: #6d28d9;">Transfer Details</h3>
                <p><strong>From:</strong> ${fromOutlet}</p>
                <p><strong>To:</strong> ${toOutlet}</p>
                <p><strong>Originally Requested By:</strong> ${requesterName}</p>
              </div>

              <div style="background: white; padding: 15px; border-radius: 8px; margin: 15px 0;">
                <h3 style="margin-top: 0; color: #6d28d9;">Items Dispatched (${itemCount})</h3>
                <ul style="padding-left: 20px;">${itemsListHtml}</ul>
                ${packagingCount > 0 ? `<h4 style="color: #6d28d9;">Packaging (${packagingCount})</h4><ul style="padding-left: 20px;">${packagingListHtml}</ul>` : ''}
              </div>

              <div style="background: #faf5ff; padding: 15px; border-radius: 8px; margin: 15px 0; border-left: 4px solid #8b5cf6;">
                <p style="margin: 0;"><strong>Action Required:</strong> Store manager should mark as received once items arrive.</p>
              </div>

              <a href="${actionUrl}" style="display: inline-block; background: #8b5cf6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin-top: 10px;">Track Transfer</a>
            </div>
            <div style="background: #1e293b; color: #94a3b8; padding: 15px; border-radius: 0 0 8px 8px; text-align: center; font-size: 12px;">
              <p style="margin: 0;">This is an automated notification from your Inventory Management System</p>
            </div>
          </div>
        `
      }

    case 'received':
      return {
        subject: `✅ Stock Transfer Received - ${toOutlet}`,
        text: `Stock transfer to ${toOutlet} has been received successfully.\n\nFrom: ${fromOutlet}\nTo: ${toOutlet}\nItems: ${itemCount}\n\nNo variances detected.`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background: linear-gradient(135deg, #22c55e, #16a34a); color: white; padding: 20px; border-radius: 8px 8px 0 0;">
              <h1 style="margin: 0; font-size: 24px;">✅ Stock Transfer Received</h1>
            </div>
            <div style="background: #f8fafc; padding: 20px; border: 1px solid #e2e8f0; border-top: none;">
              <p>The stock transfer has been received successfully with no discrepancies!</p>
              
              <div style="background: white; padding: 15px; border-radius: 8px; margin: 15px 0;">
                <h3 style="margin-top: 0; color: #166534;">Transfer Details</h3>
                <p><strong>From:</strong> ${fromOutlet}</p>
                <p><strong>To:</strong> ${toOutlet}</p>
                <p><strong>Originally Requested By:</strong> ${requesterName}</p>
              </div>

              <div style="background: #f0fdf4; padding: 15px; border-radius: 8px; margin: 15px 0; border-left: 4px solid #22c55e;">
                <p style="margin: 0;"><strong>Status:</strong> All items received in full. Transfer complete.</p>
              </div>

              <a href="${actionUrl}" style="display: inline-block; background: #22c55e; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin-top: 10px;">View Details</a>
            </div>
            <div style="background: #1e293b; color: #94a3b8; padding: 15px; border-radius: 0 0 8px 8px; text-align: center; font-size: 12px;">
              <p style="margin: 0;">This is an automated notification from your Inventory Management System</p>
            </div>
          </div>
        `
      }

    case 'variance':
      const variances = additionalData?.variances || []
      const varianceListHtml = variances.map((v: any) => 
        `<li><strong>${v.product || 'Unknown'}</strong>: Expected ${v.expected}, Received ${v.received} (Variance: ${v.variance}) - <span style="color: ${v.severity === 'critical' || v.severity === 'high' ? '#dc2626' : '#f59e0b'};">${v.severity?.toUpperCase()}</span></li>`
      ).join('') || '<li>No variance details</li>'

      return {
        subject: `⚠️ Transfer Variance Detected - ${toOutlet}`,
        text: `A stock transfer to ${toOutlet} has been received with variances detected.\n\nFrom: ${fromOutlet}\nTo: ${toOutlet}\nVariances: ${variances.length}\n\nPlease investigate.`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background: linear-gradient(135deg, #f59e0b, #d97706); color: white; padding: 20px; border-radius: 8px 8px 0 0;">
              <h1 style="margin: 0; font-size: 24px;">⚠️ Transfer Variance Detected</h1>
            </div>
            <div style="background: #f8fafc; padding: 20px; border: 1px solid #e2e8f0; border-top: none;">
              <p>A stock transfer has been received with discrepancies. Investigation is required.</p>
              
              <div style="background: white; padding: 15px; border-radius: 8px; margin: 15px 0;">
                <h3 style="margin-top: 0; color: #b45309;">Transfer Details</h3>
                <p><strong>From:</strong> ${fromOutlet}</p>
                <p><strong>To:</strong> ${toOutlet}</p>
                <p><strong>Originally Requested By:</strong> ${requesterName}</p>
              </div>

              <div style="background: #fffbeb; padding: 15px; border-radius: 8px; margin: 15px 0; border-left: 4px solid #f59e0b;">
                <h3 style="margin-top: 0; color: #b45309;">Variance Details (${variances.length})</h3>
                <ul style="padding-left: 20px;">${varianceListHtml}</ul>
              </div>

              <div style="background: #fef2f2; padding: 15px; border-radius: 8px; margin: 15px 0; border-left: 4px solid #ef4444;">
                <p style="margin: 0;"><strong>Action Required:</strong> Please investigate these discrepancies and take corrective action.</p>
              </div>

              <a href="${actionUrl}" style="display: inline-block; background: #f59e0b; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin-top: 10px;">Review Variance</a>
            </div>
            <div style="background: #1e293b; color: #94a3b8; padding: 15px; border-radius: 0 0 8px 8px; text-align: center; font-size: 12px;">
              <p style="margin: 0;">This is an automated notification from your Inventory Management System</p>
            </div>
          </div>
        `
      }

    default:
      return {
        subject: `Stock Transfer Update - ${toOutlet}`,
        text: `There has been an update to the stock transfer request.\n\nFrom: ${fromOutlet}\nTo: ${toOutlet}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background: linear-gradient(135deg, #6b7280, #4b5563); color: white; padding: 20px; border-radius: 8px 8px 0 0;">
              <h1 style="margin: 0; font-size: 24px;">Stock Transfer Update</h1>
            </div>
            <div style="background: #f8fafc; padding: 20px; border: 1px solid #e2e8f0; border-top: none;">
              <p>There has been an update to a stock transfer request.</p>
              <div style="background: white; padding: 15px; border-radius: 8px; margin: 15px 0;">
                <p><strong>From:</strong> ${fromOutlet}</p>
                <p><strong>To:</strong> ${toOutlet}</p>
              </div>
              <a href="${actionUrl}" style="display: inline-block; background: #6b7280; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin-top: 10px;">View Details</a>
            </div>
          </div>
        `
      }
  }
}
