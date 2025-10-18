-- Fix RLS policies for critical security issues (handling existing policies)

-- 1. CUSTOMERS TABLE - Protect customer PII
DROP POLICY IF EXISTS "Authenticated users can manage customers" ON customers;
DROP POLICY IF EXISTS "Authorized users can view customers" ON customers;
DROP POLICY IF EXISTS "Authorized users can insert customers" ON customers;
DROP POLICY IF EXISTS "Authorized users can update customers" ON customers;
DROP POLICY IF EXISTS "Authorized users can delete customers" ON customers;

CREATE POLICY "Authorized users can view customers"
ON customers FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = auth.uid()
    AND role IN ('super_admin', 'super_manager', 'store_manager')
    AND is_active = true
  )
);

CREATE POLICY "Authorized users can insert customers"
ON customers FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = auth.uid()
    AND role IN ('super_admin', 'super_manager', 'store_manager')
    AND is_active = true
  )
);

CREATE POLICY "Authorized users can update customers"
ON customers FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = auth.uid()
    AND role IN ('super_admin', 'super_manager', 'store_manager')
    AND is_active = true
  )
);

CREATE POLICY "Authorized users can delete customers"
ON customers FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = auth.uid()
    AND role IN ('super_admin', 'super_manager')
    AND is_active = true
  )
);

-- 2. ORDERS TABLE - Protect order data and customer addresses
DROP POLICY IF EXISTS "Authenticated users can manage orders" ON orders;
DROP POLICY IF EXISTS "Authorized users can view orders" ON orders;
DROP POLICY IF EXISTS "Authorized users can insert orders" ON orders;
DROP POLICY IF EXISTS "Authorized users can update orders" ON orders;
DROP POLICY IF EXISTS "Managers can delete orders" ON orders;

CREATE POLICY "Authorized users can view orders"
ON orders FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = auth.uid()
    AND role IN ('super_admin', 'super_manager', 'store_manager', 'warehouse_manager', 'staff', 'dispatch_manager', 'returns_manager')
    AND is_active = true
  )
);

CREATE POLICY "Authorized users can insert orders"
ON orders FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = auth.uid()
    AND role IN ('super_admin', 'super_manager', 'store_manager')
    AND is_active = true
  )
);

CREATE POLICY "Authorized users can update orders"
ON orders FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = auth.uid()
    AND role IN ('super_admin', 'super_manager', 'store_manager', 'warehouse_manager', 'dispatch_manager', 'returns_manager')
    AND is_active = true
  )
);

CREATE POLICY "Managers can delete orders"
ON orders FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = auth.uid()
    AND role IN ('super_admin', 'super_manager')
    AND is_active = true
  )
);

-- 3. SUPPLIERS TABLE - Ensure it exists and protect supplier business information
DROP POLICY IF EXISTS "Authorized users can view suppliers" ON suppliers;
DROP POLICY IF EXISTS "Managers can manage suppliers" ON suppliers;

ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authorized users can view suppliers"
ON suppliers FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = auth.uid()
    AND role IN ('super_admin', 'super_manager', 'warehouse_manager', 'supplier')
    AND is_active = true
  )
);

CREATE POLICY "Managers can manage suppliers"
ON suppliers FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = auth.uid()
    AND role IN ('super_admin', 'super_manager')
    AND is_active = true
  )
);

-- 4. SCANS TABLE - Create and protect scan history
DROP TABLE IF EXISTS scans CASCADE;

CREATE TABLE scans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  barcode TEXT NOT NULL,
  scan_type TEXT NOT NULL,
  scan_method TEXT NOT NULL,
  product_id UUID REFERENCES products(id),
  outlet_id UUID REFERENCES outlets(id),
  scanned_by UUID NOT NULL,
  status TEXT DEFAULT 'success',
  error_message TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

ALTER TABLE scans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own scans"
ON scans FOR SELECT
USING (scanned_by = auth.uid());

CREATE POLICY "Users can create scans"
ON scans FOR INSERT
WITH CHECK (scanned_by = auth.uid());

CREATE POLICY "Managers can view all scans"
ON scans FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = auth.uid()
    AND role IN ('super_admin', 'super_manager', 'store_manager', 'warehouse_manager')
    AND is_active = true
  )
);

-- 5. Fix PRODUCTS TABLE - Appropriate access control
DROP POLICY IF EXISTS "Authenticated users can view products" ON products;
DROP POLICY IF EXISTS "Managers can manage products" ON products;
DROP POLICY IF EXISTS "Managers can insert products" ON products;
DROP POLICY IF EXISTS "Managers can update products" ON products;
DROP POLICY IF EXISTS "Admins can delete products" ON products;

CREATE POLICY "Authenticated users can view products"
ON products FOR SELECT
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Managers can insert products"
ON products FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = auth.uid()
    AND role IN ('super_admin', 'super_manager', 'warehouse_manager')
    AND is_active = true
  )
);

CREATE POLICY "Managers can update products"
ON products FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = auth.uid()
    AND role IN ('super_admin', 'super_manager', 'warehouse_manager')
    AND is_active = true
  )
);

CREATE POLICY "Admins can delete products"
ON products FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = auth.uid()
    AND role IN ('super_admin', 'super_manager')
    AND is_active = true
  )
);

-- Add indexes for better performance on scans table
CREATE INDEX idx_scans_scanned_by ON scans(scanned_by);
CREATE INDEX idx_scans_created_at ON scans(created_at DESC);
CREATE INDEX idx_scans_product_id ON scans(product_id);
CREATE INDEX idx_scans_outlet_id ON scans(outlet_id);