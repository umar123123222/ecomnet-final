
export interface Customer {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  address: string;
  city: string;
  total_orders: number;
  return_count: number;
  is_suspicious: boolean;
  suspicious_reason?: string;
  created_at: string;
  updated_at: string;
}

export interface Order {
  id: string;
  order_number: string;
  customer_id: string;
  customer_name: string;
  customer_phone: string;
  customer_address: string;
  city: string;
  status: 'pending' | 'booked' | 'dispatched' | 'delivered' | 'cancelled' | 'returned';
  courier: 'postex' | 'leopard' | 'tcs' | 'other';
  tracking_id?: string;
  total_amount: number;
  items: Array<{
    id: string;
    name: string;
    quantity: number;
    price: number;
  }>;
  tags?: string[];
  notes?: string;
  gpt_score?: number;
  assigned_to?: string;
  verification_status: 'pending' | 'approved' | 'disapproved';
  verification_notes?: string;
  verified_by?: string;
  verified_at?: string;
  created_at: string;
  updated_at: string;
  dispatched_at?: string;
  delivered_at?: string;
}

export interface Return {
  id: string;
  order_id: string;
  tracking_id: string;
  reason?: string;
  return_status: 'in_transit' | 'received' | 'processed' | 'completed';
  worth?: number;
  tags?: string[];
  notes?: string;
  received_by?: string;
  received_at?: string;
  created_at: string;
  updated_at: string;
  order?: Order;
}

export interface Profile {
  id: string;
  email: string;
  full_name: string;
  role: 'owner' | 'store_manager' | 'dispatch_manager' | 'returns_manager' | 'staff';
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ActivityLog {
  id: string;
  user_id: string;
  action: string;
  entity_type: string;
  entity_id: string;
  details?: any;
  created_at: string;
}

export interface UserPerformance {
  id: string;
  user_id: string;
  date: string;
  orders_processed: number;
  returns_handled: number;
  addresses_verified: number;
  created_at: string;
}
