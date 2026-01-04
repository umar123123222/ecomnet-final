import { supabase } from '@/integrations/supabase/client';
import { formatCurrency as formatCurrencyUtil } from '@/utils/currency';

export interface WhatsAppMessageParams {
  to: string;
  message: string;
  template?: {
    name: string;
    language: string;
    components?: any[];
  };
}

/**
 * Send a WhatsApp message to a customer
 */
export async function sendWhatsAppMessage(params: WhatsAppMessageParams): Promise<boolean> {
  try {
    const { data, error } = await supabase.functions.invoke('send-whatsapp', {
      body: params
    });

    if (error) {
      console.error('Error sending WhatsApp message:', error);
      return false;
    }

    if (!data.success) {
      console.error('WhatsApp message failed:', data.error);
      return false;
    }

    console.log('WhatsApp message sent successfully:', data.messageId);
    return true;
  } catch (error) {
    console.error('Exception sending WhatsApp message:', error);
    return false;
  }
}

/**
 * Update customer's last WhatsApp sent timestamp
 */
export async function updateCustomerWhatsAppTimestamp(customerId: string): Promise<void> {
  try {
    await supabase
      .from('customers')
      .update({ last_whatsapp_sent: new Date().toISOString() })
      .eq('id', customerId);
  } catch (error) {
    console.error('Error updating customer WhatsApp timestamp:', error);
  }
}

/**
 * Check if customer has opted in for WhatsApp
 */
export async function checkWhatsAppOptIn(customerId: string): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from('customers')
      .select('whatsapp_opt_in')
      .eq('id', customerId)
      .single();

    if (error) {
      console.error('Error checking WhatsApp opt-in:', error);
      return false;
    }

    return data?.whatsapp_opt_in ?? true; // Default to true if not set
  } catch (error) {
    console.error('Exception checking WhatsApp opt-in:', error);
    return false;
  }
}

/**
 * Send order confirmation via WhatsApp
 */
export async function sendOrderConfirmation(
  customerPhone: string,
  orderNumber: string,
  customerName: string
): Promise<boolean> {
  const message = `Hi ${customerName}! Your order #${orderNumber} has been confirmed. We'll notify you once it's dispatched. Thank you for shopping with us!`;
  
  return await sendWhatsAppMessage({
    to: customerPhone,
    message
  });
}

/**
 * Send dispatch notification via WhatsApp
 */
export async function sendDispatchNotification(
  customerPhone: string,
  orderNumber: string,
  trackingId: string,
  courier: string,
  customerName: string
): Promise<boolean> {
  const message = `Hi ${customerName}! Your order #${orderNumber} has been dispatched via ${courier}. Tracking ID: ${trackingId}. Track your order for updates!`;
  
  return await sendWhatsAppMessage({
    to: customerPhone,
    message
  });
}

/**
 * Send delivery notification via WhatsApp
 */
export async function sendDeliveryNotification(
  customerPhone: string,
  orderNumber: string,
  customerName: string
): Promise<boolean> {
  const message = `Hi ${customerName}! Great news! Your order #${orderNumber} has been delivered. We hope you love your purchase! Please let us know if you have any questions.`;
  
  return await sendWhatsAppMessage({
    to: customerPhone,
    message
  });
}

/**
 * Send return confirmation via WhatsApp
 */
export async function sendReturnConfirmation(
  customerPhone: string,
  orderNumber: string,
  trackingId: string,
  customerName: string
): Promise<boolean> {
  const message = `Hi ${customerName}! We've received your return request for order #${orderNumber}. Return tracking ID: ${trackingId}. We'll process it as soon as we receive the item.`;
  
  return await sendWhatsAppMessage({
    to: customerPhone,
    message
  });
}

/**
 * WhatsApp notification templates for common scenarios
 */
export const WhatsAppTemplates = {
  orderConfirmed: (customerName: string, orderNumber: string) =>
    `Hi ${customerName}! Your order #${orderNumber} has been confirmed. We'll notify you once it's dispatched. Thank you for shopping with us!`,

  orderDispatched: (customerName: string, orderNumber: string, trackingId: string, courier: string) =>
    `Hi ${customerName}! Your order #${orderNumber} has been dispatched via ${courier}. Tracking ID: ${trackingId}. Track your order for updates!`,

  orderDelivered: (customerName: string, orderNumber: string) =>
    `Hi ${customerName}! Great news! Your order #${orderNumber} has been delivered. We hope you love your purchase!`,

  returnReceived: (customerName: string, orderNumber: string) =>
    `Hi ${customerName}! We've received your return for order #${orderNumber}. We're processing it now and will update you soon.`,

  returnRefunded: (customerName: string, orderNumber: string, amount: number) =>
    `Hi ${customerName}! Your refund for order #${orderNumber} has been processed. Amount: ${formatCurrencyUtil(amount)}. It will reflect in your account in 3-5 business days.`,
};
