// Type definitions for inventory management system

export interface Product {
  id: string;
  sku: string;
  name: string;
  description?: string | null;
  category?: string | null;
  price: number;
  cost?: number | null;
  reorder_level: number;
  is_active: boolean;
  is_bundle?: boolean;
  created_at: string;
  updated_at: string;
  size?: string | null;
  unit_type?: string | null;
  requires_packaging?: boolean;
  packaging_metadata?: any;
  shopify_product_id?: number | null;
  shopify_variant_id?: number | null;
  synced_from_shopify?: boolean;
}

export interface PackagingItem {
  id: string;
  name: string;
  sku: string;
  type: 'bottle' | 'box' | 'label' | 'cap' | 'bag' | 'wrapper' | 'other';
  size?: string;
  material?: string;
  cost: number;
  reorder_level: number;
  current_stock: number;
  supplier_id?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Outlet {
  id: string;
  name: string;
  outlet_type: 'warehouse' | 'retail';
  address?: string;
  city?: string;
  phone?: string;
  manager_id?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Inventory {
  id: string;
  product_id: string;
  outlet_id: string;
  quantity: number;
  reserved_quantity: number;
  available_quantity: number;
  last_counted_at?: string;
  created_at: string;
  updated_at: string;
  product?: Product;
  outlet?: Outlet;
}

export interface StockMovement {
  id: string;
  product_id: string;
  outlet_id: string;
  movement_type: 'sale' | 'purchase' | 'adjustment' | 'transfer_in' | 'transfer_out' | 'return';
  quantity: number;
  reference_id?: string;
  notes?: string;
  created_by: string;
  created_at: string;
}

export interface StockTransferRequest {
  id: string;
  from_outlet_id: string;
  to_outlet_id: string;
  status: 'pending' | 'approved' | 'in_transit' | 'completed' | 'rejected' | 'cancelled';
  requested_by: string;
  approved_by?: string;
  completed_by?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
  from_outlet?: Outlet;
  to_outlet?: Outlet;
}

export interface StockTransferItem {
  id: string;
  transfer_id: string;
  product_id: string;
  quantity_requested: number;
  quantity_approved?: number;
  quantity_received?: number;
  product?: Product;
}
