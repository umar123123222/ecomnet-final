import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface WebhookMessage {
  from: string;
  text: {
    body: string;
  };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Handle GET for webhook verification
  if (req.method === 'GET') {
    const url = new URL(req.url);
    const mode = url.searchParams.get('hub.mode');
    const token = url.searchParams.get('hub.verify_token');
    const challenge = url.searchParams.get('hub.challenge');

    const verifyToken = Deno.env.get('WHATSAPP_VERIFY_TOKEN') || 'your_verify_token';

    if (mode === 'subscribe' && token === verifyToken) {
      console.log('Webhook verified');
      return new Response(challenge, { status: 200 });
    }

    return new Response('Forbidden', { status: 403 });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    const payload = await req.json();
    console.log('Webhook payload:', JSON.stringify(payload, null, 2));

    // Parse WhatsApp webhook
    const entry = payload.entry?.[0];
    const changes = entry?.changes?.[0];
    const value = changes?.value;
    const messages: WebhookMessage[] = value?.messages || [];

    if (messages.length === 0) {
      return new Response('No messages', { status: 200 });
    }

    const message = messages[0];
    const from = message.from;
    const messageText = message.text?.body?.trim().toUpperCase();

    console.log('Processing message from:', from, 'text:', messageText);

    // Find customer by phone
    const { data: customer } = await supabase
      .from('customers')
      .select('id')
      .eq('phone', from)
      .single();

    if (!customer) {
      console.log('Customer not found for phone:', from);
      return new Response('Customer not found', { status: 200 });
    }

    // Find pending confirmation for this customer
    const { data: confirmation } = await supabase
      .from('order_confirmations')
      .select('*, order:orders(*)')
      .eq('customer_id', customer.id)
      .in('status', ['pending', 'sent', 'delivered', 'read'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!confirmation) {
      console.log('No pending confirmation found for customer:', customer.id);
      return new Response('No pending confirmation', { status: 200 });
    }

    // Parse response
    let customerResponse = 'no_response';
    if (['YES', 'CONFIRM', 'OK', 'CONFIRMED'].includes(messageText)) {
      customerResponse = 'confirmed';
    } else if (['NO', 'CANCEL', 'CANCELLED'].includes(messageText)) {
      customerResponse = 'cancelled';
    }

    // Update confirmation
    const { error: updateError } = await supabase
      .from('order_confirmations')
      .update({
        customer_response: customerResponse,
        response_at: new Date().toISOString(),
        status: customerResponse === 'confirmed' ? 'confirmed' : customerResponse === 'cancelled' ? 'cancelled' : 'read',
        updated_at: new Date().toISOString(),
      })
      .eq('id', confirmation.id);

    if (updateError) {
      console.error('Error updating confirmation:', updateError);
    }

    // Send acknowledgment
    let ackMessage = '';
    if (customerResponse === 'confirmed') {
      ackMessage = `Thank you! Your order #${confirmation.order.order_number} has been confirmed. We'll process it shortly.`;
    } else if (customerResponse === 'cancelled') {
      ackMessage = `Your order #${confirmation.order.order_number} has been cancelled. If this was a mistake, please contact us.`;
    } else {
      ackMessage = `We received your message. Please reply with YES/CONFIRM or NO/CANCEL for order #${confirmation.order.order_number}.`;
    }

    await sendWhatsAppMessage(from, ackMessage);

    console.log('Confirmation response processed:', confirmation.id, customerResponse);

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );

  } catch (error) {
    console.error('Error processing webhook:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );
  }
});

async function sendWhatsAppMessage(phone: string, message: string) {
  try {
    const accessToken = Deno.env.get('WHATSAPP_ACCESS_TOKEN');
    const phoneNumberId = Deno.env.get('WHATSAPP_PHONE_NUMBER_ID');

    if (!accessToken || !phoneNumberId) return;

    await fetch(
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
  } catch (error) {
    console.error('Error sending WhatsApp message:', error);
  }
}
