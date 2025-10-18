export interface OrderConfirmation {
  id: string;
  order_id: string;
  customer_id: string;
  confirmation_type: 'order' | 'address' | 'dispatch' | 'delivery';
  sent_at?: string;
  sent_via?: 'whatsapp' | 'sms' | 'email' | 'call';
  status: 'pending' | 'sent' | 'delivered' | 'read' | 'confirmed' | 'cancelled' | 'failed' | 'expired';
  customer_response?: 'confirmed' | 'cancelled' | 'modified' | 'no_response';
  response_at?: string;
  retry_count: number;
  retry_scheduled_at?: string;
  message_content?: string;
  message_id?: string;
  error_message?: string;
  created_at: string;
  updated_at: string;
}

export interface ConfirmationWithDetails extends OrderConfirmation {
  order: {
    order_number: string;
    total_amount: number;
    customer_name: string;
    customer_phone: string;
    city: string;
  };
  customer: {
    name: string;
    phone: string;
    whatsapp_opt_in: boolean;
  };
}
