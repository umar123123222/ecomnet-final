import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SendConfirmationRequest {
  confirmation_id: string;
  force?: boolean;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    const { confirmation_id, force = false }: SendConfirmationRequest = await req.json();

    console.log('Sending order confirmation:', confirmation_id);

    // Get confirmation details
    const { data: confirmation, error: confError } = await supabase
      .from('order_confirmations')
      .select(`
        *,
        order:orders(*),
        customer:customers(*)
      `)
      .eq('id', confirmation_id)
      .single();

    if (confError || !confirmation) {
      throw new Error('Confirmation not found');
    }

    // Check if already sent (unless forced)
    if (!force && confirmation.status !== 'pending' && confirmation.status !== 'failed') {
      return new Response(
        JSON.stringify({ message: 'Confirmation already processed' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    // Check customer opt-in
    if (!confirmation.customer.whatsapp_opt_in) {
      await supabase
        .from('order_confirmations')
        .update({
          status: 'failed',
          error_message: 'Customer opted out of WhatsApp',
          updated_at: new Date().toISOString(),
        })
        .eq('id', confirmation_id);

      throw new Error('Customer opted out');
    }

    // Prepare confirmation message
    const messageContent = buildConfirmationMessage(confirmation);

    // Send via WhatsApp
    const waResponse = await sendWhatsAppMessage(
      confirmation.customer.phone,
      messageContent
    );

    if (!waResponse.success) {
      // Schedule retry
      const nextRetry = new Date();
      nextRetry.setHours(nextRetry.getHours() + (confirmation.retry_count + 1) * 12);

      await supabase
        .from('order_confirmations')
        .update({
          status: 'failed',
          error_message: waResponse.error,
          retry_count: confirmation.retry_count + 1,
          retry_scheduled_at: nextRetry.toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', confirmation_id);

      throw new Error(waResponse.error);
    }

    // Update confirmation as sent
    await supabase
      .from('order_confirmations')
      .update({
        status: 'sent',
        sent_at: new Date().toISOString(),
        sent_via: 'whatsapp',
        message_content: messageContent,
        message_id: waResponse.message_id,
        updated_at: new Date().toISOString(),
      })
      .eq('id', confirmation_id);

    console.log('Confirmation sent successfully:', confirmation_id);

    return new Response(
      JSON.stringify({ success: true, message_id: waResponse.message_id }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );

  } catch (error) {
    console.error('Error sending confirmation:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    );
  }
});

function buildConfirmationMessage(confirmation: any): string {
  const order = confirmation.order;
  const customer = confirmation.customer;

  let message = `Hello ${customer.name}!\n\n`;
  message += `Thank you for your order #${order.order_number}.\n\n`;
  message += `📦 *Order Details:*\n`;
  message += `Total: Rs ${order.total_amount}\n`;
  message += `Delivery Address: ${order.customer_address}\n`;
  message += `City: ${order.city}\n\n`;
  message += `Please confirm your order by replying:\n`;
  message += `✅ Reply "YES" or "CONFIRM" to confirm\n`;
  message += `❌ Reply "NO" or "CANCEL" to cancel\n\n`;
  message += `This order will be automatically processed in 48 hours if we don't hear from you.\n\n`;
  message += `Thank you for shopping with us!`;

  return message;
}

async function sendWhatsAppMessage(phone: string, message: string): Promise<any> {
  try {
    const accessToken = Deno.env.get('WHATSAPP_ACCESS_TOKEN');
    const phoneNumberId = Deno.env.get('WHATSAPP_PHONE_NUMBER_ID');

    if (!accessToken || !phoneNumberId) {
      return { success: false, error: 'WhatsApp credentials not configured' };
    }

    const response = await fetch(
      `https://graph.facebook.com/v17.0/${phoneNumberId}/messages`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to: phone,
          type: 'text',
          text: { body: message },
        }),
      }
    );

    const data = await response.json();

    if (!response.ok) {
      return { success: false, error: data.error?.message || 'Failed to send message' };
    }

    return {
      success: true,
      message_id: data.messages?.[0]?.id,
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
}
