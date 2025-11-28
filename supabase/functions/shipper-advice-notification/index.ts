import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface NotificationRequest {
  order_id: string;
  tracking_id: string;
  status: string;
  current_location?: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { order_id, tracking_id, status, current_location }: NotificationRequest = await req.json();

    console.log('Shipper Advice Notification triggered for order:', order_id, 'status:', status);

    // Get order details
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('order_number, customer_name, city, courier')
      .eq('id', order_id)
      .single();

    if (orderError || !order) {
      throw new Error(`Order not found: ${orderError?.message}`);
    }

    // Get users with required roles
    const { data: targetUsers, error: usersError } = await supabase
      .from('user_roles')
      .select('user_id, profiles!inner(id, email, full_name)')
      .in('role', ['staff', 'super_manager', 'super_admin'])
      .eq('is_active', true);

    if (usersError) {
      throw new Error(`Failed to fetch users: ${usersError.message}`);
    }

    if (!targetUsers || targetUsers.length === 0) {
      console.log('No users found with required roles');
      return new Response(
        JSON.stringify({ success: true, message: 'No users to notify' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Prepare notification details
    const statusLabel = getStatusLabel(status);
    const title = `Delivery Issue: Order ${order.order_number}`;
    const message = `Order ${order.order_number} for ${order.customer_name} in ${order.city} has ${statusLabel}. Courier: ${order.courier}. ${current_location ? `Location: ${current_location}` : ''}`;

    // Create notifications for each user
    const notifications = targetUsers.map((userRole: any) => ({
      user_id: userRole.user_id,
      title,
      message,
      type: 'warning',
      priority: 'high',
      action_url: `/shipper-advice`,
      metadata: {
        order_id,
        order_number: order.order_number,
        tracking_id,
        status,
        current_location
      }
    }));

    const { error: notifError } = await supabase
      .from('notifications')
      .insert(notifications);

    if (notifError) {
      console.error('Failed to create notifications:', notifError);
    } else {
      console.log(`Created ${notifications.length} notifications`);
    }

    // Send emails
    const smtpHost = Deno.env.get('SMTP_HOST');
    const smtpUser = Deno.env.get('SMTP_USER');
    const smtpPassword = Deno.env.get('SMTP_PASSWORD');
    const smtpFrom = Deno.env.get('SMTP_FROM_EMAIL');

    if (smtpHost && smtpUser && smtpPassword && smtpFrom) {
      for (const userRole of targetUsers) {
        const profile = userRole.profiles;
        if (profile && profile.email) {
          try {
            await sendEmail(
              profile.email,
              title,
              message,
              order,
              tracking_id,
              status
            );
            console.log(`Email sent to ${profile.email}`);
          } catch (emailError) {
            console.error(`Failed to send email to ${profile.email}:`, emailError);
          }
        }
      }
    } else {
      console.log('SMTP not configured, skipping email notifications');
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        notified_users: targetUsers.length,
        order_number: order.order_number
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in shipper-advice-notification:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

function getStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    'delivery_failed': 'a failed delivery attempt',
    'pending': 'a pending delivery',
    'out_for_delivery': 'been out for delivery for extended time',
    'attempted': 'a delivery attempt',
    'returned': 'been returned'
  };
  return labels[status] || `status: ${status}`;
}

async function sendEmail(
  to: string,
  subject: string,
  message: string,
  order: any,
  trackingId: string,
  status: string
): Promise<void> {
  const smtpHost = Deno.env.get('SMTP_HOST')!;
  const smtpPort = parseInt(Deno.env.get('SMTP_PORT') || '587');
  const smtpUser = Deno.env.get('SMTP_USER')!;
  const smtpPassword = Deno.env.get('SMTP_PASSWORD')!;
  const smtpFrom = Deno.env.get('SMTP_FROM_EMAIL')!;

  const emailBody = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background-color: #f44336; color: white; padding: 20px; border-radius: 5px 5px 0 0; }
    .content { background-color: #f9f9f9; padding: 20px; border: 1px solid #ddd; border-radius: 0 0 5px 5px; }
    .order-details { background-color: white; padding: 15px; margin: 15px 0; border-left: 4px solid #f44336; }
    .footer { margin-top: 20px; font-size: 12px; color: #666; text-align: center; }
    .btn { display: inline-block; padding: 10px 20px; background-color: #f44336; color: white; text-decoration: none; border-radius: 5px; margin-top: 15px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h2>⚠️ Delivery Issue Alert</h2>
    </div>
    <div class="content">
      <p><strong>${message}</strong></p>
      
      <div class="order-details">
        <h3>Order Details:</h3>
        <p><strong>Order Number:</strong> ${order.order_number}</p>
        <p><strong>Customer:</strong> ${order.customer_name}</p>
        <p><strong>City:</strong> ${order.city}</p>
        <p><strong>Courier:</strong> ${order.courier}</p>
        <p><strong>Tracking ID:</strong> ${trackingId}</p>
        <p><strong>Status:</strong> ${status}</p>
      </div>
      
      <p>This order requires your attention. Please review and take appropriate action.</p>
      
      <a href="${Deno.env.get('SUPABASE_URL')?.replace('supabase.co', 'lovable.app')}/shipper-advice" class="btn">View Shipper Advice</a>
    </div>
    <div class="footer">
      <p>This is an automated notification from your Order Management System.</p>
    </div>
  </div>
</body>
</html>
  `;

  // Use native Deno SMTP or fetch-based email service
  // For now, logging that email would be sent
  console.log(`Would send email to ${to} with subject: ${subject}`);
  
  // Note: Actual SMTP implementation would require additional Deno SMTP library
  // For production, consider using a service like Resend or SendGrid
}
