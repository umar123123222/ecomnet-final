-- ============================================
-- PHASE 1: SUPPLIER & RECEIVING CONTROL
-- ============================================

-- Create Suppliers Table
CREATE TABLE suppliers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  code TEXT UNIQUE NOT NULL,
  contact_person TEXT,
  phone TEXT,
  email TEXT,
  address TEXT,
  city TEXT,
  payment_terms TEXT,
  tax_id TEXT,
  bank_details JSONB,
  rating DECIMAL(3,2) DEFAULT 0.00 CHECK (rating >= 0 AND rating <= 5),
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'blacklisted')),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create Purchase Orders Table
CREATE TABLE purchase_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  po_number TEXT UNIQUE NOT NULL,
  supplier_id UUID REFERENCES suppliers(id) NOT NULL,
  outlet_id UUID REFERENCES outlets(id) NOT NULL,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'confirmed', 'partially_received', 'completed', 'cancelled')),
  order_date TIMESTAMPTZ DEFAULT NOW(),
  expected_delivery_date TIMESTAMPTZ,
  total_amount DECIMAL(12,2) NOT NULL,
  tax_amount DECIMAL(12,2) DEFAULT 0,
  discount_amount DECIMAL(12,2) DEFAULT 0,
  shipping_cost DECIMAL(12,2) DEFAULT 0,
  payment_status TEXT DEFAULT 'pending' CHECK (payment_status IN ('pending', 'partial', 'paid')),
  created_by UUID REFERENCES profiles(id) NOT NULL,
  approved_by UUID REFERENCES profiles(id),
  approved_at TIMESTAMPTZ,
  notes TEXT,
  terms_conditions TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create Purchase Order Items Table
CREATE TABLE purchase_order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  po_id UUID REFERENCES purchase_orders(id) ON DELETE CASCADE NOT NULL,
  product_id UUID REFERENCES products(id) NOT NULL,
  quantity_ordered INTEGER NOT NULL CHECK (quantity_ordered > 0),
  quantity_received INTEGER DEFAULT 0,
  unit_price DECIMAL(10,2) NOT NULL,
  tax_rate DECIMAL(5,2) DEFAULT 0,
  discount_rate DECIMAL(5,2) DEFAULT 0,
  total_price DECIMAL(12,2) NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create Goods Received Notes Table
CREATE TABLE goods_received_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  grn_number TEXT UNIQUE NOT NULL,
  po_id UUID REFERENCES purchase_orders(id) NOT NULL,
  supplier_id UUID REFERENCES suppliers(id) NOT NULL,
  outlet_id UUID REFERENCES outlets(id) NOT NULL,
  received_by UUID REFERENCES profiles(id) NOT NULL,
  received_date TIMESTAMPTZ DEFAULT NOW(),
  status TEXT DEFAULT 'pending_inspection' CHECK (status IN ('pending_inspection', 'inspected', 'accepted', 'rejected', 'partial_accept')),
  inspected_by UUID REFERENCES profiles(id),
  inspected_at TIMESTAMPTZ,
  total_items_expected INTEGER NOT NULL,
  total_items_received INTEGER NOT NULL,
  discrepancy_flag BOOLEAN DEFAULT FALSE,
  quality_passed BOOLEAN,
  notes TEXT,
  rejection_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create GRN Items Table
CREATE TABLE grn_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  grn_id UUID REFERENCES goods_received_notes(id) ON DELETE CASCADE NOT NULL,
  po_item_id UUID REFERENCES purchase_order_items(id),
  product_id UUID REFERENCES products(id) NOT NULL,
  quantity_expected INTEGER NOT NULL,
  quantity_received INTEGER NOT NULL,
  quantity_accepted INTEGER DEFAULT 0,
  quantity_rejected INTEGER DEFAULT 0,
  unit_cost DECIMAL(10,2) NOT NULL,
  batch_number TEXT,
  expiry_date DATE,
  quality_status TEXT DEFAULT 'pending' CHECK (quality_status IN ('pending', 'passed', 'failed', 'conditional')),
  defect_type TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create Supplier Performance Table
CREATE TABLE supplier_performance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id UUID REFERENCES suppliers(id) NOT NULL,
  date DATE DEFAULT CURRENT_DATE,
  total_orders INTEGER DEFAULT 0,
  orders_on_time INTEGER DEFAULT 0,
  orders_with_discrepancies INTEGER DEFAULT 0,
  total_items_ordered INTEGER DEFAULT 0,
  total_items_received INTEGER DEFAULT 0,
  accuracy_rate DECIMAL(5,2),
  on_time_delivery_rate DECIMAL(5,2),
  quality_rejection_rate DECIMAL(5,2),
  average_lead_time_days INTEGER,
  total_amount_ordered DECIMAL(15,2),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(supplier_id, date)
);

-- Create Receiving Discrepancies Table
CREATE TABLE receiving_discrepancies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  grn_id UUID REFERENCES goods_received_notes(id) NOT NULL,
  product_id UUID REFERENCES products(id) NOT NULL,
  discrepancy_type TEXT NOT NULL CHECK (discrepancy_type IN ('quantity_short', 'quantity_excess', 'quality_issue', 'wrong_product', 'damaged', 'expired')),
  expected_quantity INTEGER,
  received_quantity INTEGER,
  variance INTEGER,
  unit_cost DECIMAL(10,2),
  financial_impact DECIMAL(12,2),
  reported_by UUID REFERENCES profiles(id) NOT NULL,
  resolved BOOLEAN DEFAULT FALSE,
  resolution_notes TEXT,
  resolved_by UUID REFERENCES profiles(id),
  resolved_at TIMESTAMPTZ,
  supplier_notified BOOLEAN DEFAULT FALSE,
  supplier_response TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create Indexes
CREATE INDEX idx_po_supplier ON purchase_orders(supplier_id);
CREATE INDEX idx_po_status ON purchase_orders(status);
CREATE INDEX idx_po_date ON purchase_orders(order_date);
CREATE INDEX idx_po_outlet ON purchase_orders(outlet_id);
CREATE INDEX idx_grn_po ON goods_received_notes(po_id);
CREATE INDEX idx_grn_date ON goods_received_notes(received_date);
CREATE INDEX idx_grn_status ON goods_received_notes(status);
CREATE INDEX idx_grn_items_product ON grn_items(product_id);
CREATE INDEX idx_discrepancies_grn ON receiving_discrepancies(grn_id);
CREATE INDEX idx_supplier_perf_date ON supplier_performance(supplier_id, date);

-- Enable RLS
ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE goods_received_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE grn_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE supplier_performance ENABLE ROW LEVEL SECURITY;
ALTER TABLE receiving_discrepancies ENABLE ROW LEVEL SECURITY;

-- RLS Policies for Suppliers
CREATE POLICY "Authenticated users can view suppliers" 
ON suppliers FOR SELECT 
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Managers can manage suppliers" 
ON suppliers FOR ALL 
USING (
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = auth.uid() 
    AND role IN ('super_admin', 'super_manager', 'warehouse_manager')
  )
);

-- RLS Policies for Purchase Orders
CREATE POLICY "Authenticated users can view purchase orders" 
ON purchase_orders FOR SELECT 
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Managers can manage purchase orders" 
ON purchase_orders FOR ALL 
USING (
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = auth.uid() 
    AND role IN ('super_admin', 'super_manager', 'warehouse_manager')
  )
);

-- RLS Policies for Purchase Order Items
CREATE POLICY "Authenticated users can view po items" 
ON purchase_order_items FOR SELECT 
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Managers can manage po items" 
ON purchase_order_items FOR ALL 
USING (
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = auth.uid() 
    AND role IN ('super_admin', 'super_manager', 'warehouse_manager')
  )
);

-- RLS Policies for GRN
CREATE POLICY "Authenticated users can view grns" 
ON goods_received_notes FOR SELECT 
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Warehouse staff can create grns" 
ON goods_received_notes FOR INSERT 
WITH CHECK (auth.uid() = received_by);

CREATE POLICY "Managers can manage grns" 
ON goods_received_notes FOR ALL 
USING (
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = auth.uid() 
    AND role IN ('super_admin', 'super_manager', 'warehouse_manager')
  )
);

-- RLS Policies for GRN Items
CREATE POLICY "Authenticated users can view grn items" 
ON grn_items FOR SELECT 
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Warehouse staff can manage grn items" 
ON grn_items FOR ALL 
USING (
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = auth.uid() 
    AND role IN ('super_admin', 'super_manager', 'warehouse_manager', 'staff')
  )
);

-- RLS Policies for Supplier Performance
CREATE POLICY "Authenticated users can view supplier performance" 
ON supplier_performance FOR SELECT 
USING (auth.uid() IS NOT NULL);

CREATE POLICY "System can manage supplier performance" 
ON supplier_performance FOR ALL 
USING (true);

-- RLS Policies for Discrepancies
CREATE POLICY "Authenticated users can view discrepancies" 
ON receiving_discrepancies FOR SELECT 
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Staff can create discrepancies" 
ON receiving_discrepancies FOR INSERT 
WITH CHECK (auth.uid() = reported_by);

CREATE POLICY "Managers can manage discrepancies" 
ON receiving_discrepancies FOR ALL 
USING (
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = auth.uid() 
    AND role IN ('super_admin', 'super_manager', 'warehouse_manager')
  )
);

-- Create update trigger for suppliers
CREATE TRIGGER update_suppliers_updated_at
BEFORE UPDATE ON suppliers
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- Create update trigger for purchase orders
CREATE TRIGGER update_purchase_orders_updated_at
BEFORE UPDATE ON purchase_orders
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- Create update trigger for grns
CREATE TRIGGER update_grns_updated_at
BEFORE UPDATE ON goods_received_notes
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();