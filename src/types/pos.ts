export interface POSSession {
  id: string;
  session_number: string;
  outlet_id: string;
  cashier_id: string;
  register_number?: string;
  opened_at: string;
  closed_at?: string;
  opening_cash: number;
  closing_cash?: number;
  expected_cash?: number;
  cash_difference?: number;
  status: 'open' | 'closed' | 'suspended';
  notes?: string;
  created_at: string;
}

export interface POSSale {
  id: string;
  sale_number: string;
  session_id: string;
  outlet_id: string;
  cashier_id: string;
  customer_id?: string;
  sale_date: string;
  subtotal: number;
  tax_amount: number;
  discount_amount: number;
  total_amount: number;
  amount_paid: number;
  change_amount: number;
  payment_method: 'cash' | 'card' | 'mobile_wallet' | 'split';
  payment_reference?: string;
  status: 'pending' | 'completed' | 'voided' | 'refunded';
  voided_at?: string;
  voided_by?: string;
  void_reason?: string;
  receipt_printed: boolean;
  notes?: string;
  created_at: string;
}

export interface POSSaleItem {
  id: string;
  sale_id: string;
  product_id: string;
  quantity: number;
  unit_price: number;
  discount_percent: number;
  discount_amount: number;
  line_total: number;
  created_at: string;
  product?: {
    name: string;
    sku: string;
  };
}

export interface POSCartItem {
  product_id: string;
  name: string;
  sku: string;
  quantity: number;
  unit_price: number;
  discount_percent: number;
  available_quantity: number;
}
