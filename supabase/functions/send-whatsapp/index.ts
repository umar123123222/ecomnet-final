import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { getAPISetting } from "../_shared/apiSettings.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface WhatsAppMessageRequest {
  to: string; // Phone number in international format (e.g., +923001234567)
  message: string;
  template?: {
    name: string;
    language: string;
    components?: any[];
  };
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { to, message, template }: WhatsAppMessageRequest = await req.json();
    
    if (!to) {
      throw new Error('Recipient phone number is required');
    }

    const accessToken = getAPISetting('WHATSAPP_ACCESS_TOKEN');
    const phoneNumberId = getAPISetting('WHATSAPP_PHONE_NUMBER_ID');

    if (!accessToken || !phoneNumberId) {
      throw new Error('WhatsApp API credentials not configured');
    }

    // Normalize phone number (remove + and any spaces)
    const normalizedPhone = to.replace(/[\s+]/g, '');

    let messageBody: any;

    if (template) {
      // Send template message
      messageBody = {
        messaging_product: 'whatsapp',
        to: normalizedPhone,
        type: 'template',
        template: {
          name: template.name,
          language: {
            code: template.language
          },
          components: template.components || []
        }
      };
    } else {
      // Send text message
      messageBody = {
        messaging_product: 'whatsapp',
        to: normalizedPhone,
        type: 'text',
        text: {
          body: message
        }
      };
    }

    console.log('Sending WhatsApp message to:', normalizedPhone);

    const response = await fetch(
      `https://graph.facebook.com/v18.0/${phoneNumberId}/messages`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(messageBody),
      }
    );

    const responseData = await response.json();

    if (!response.ok) {
      console.error('WhatsApp API error:', responseData);
      throw new Error(responseData.error?.message || 'Failed to send WhatsApp message');
    }

    console.log('WhatsApp message sent successfully:', responseData);

    return new Response(
      JSON.stringify({
        success: true,
        messageId: responseData.messages?.[0]?.id,
        data: responseData
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error: any) {
    console.error('Error in send-whatsapp function:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
