-- Phase 1B: Enhanced Inventory & Supplier Management - Main Schema

-- 1.1: Enhance products table
ALTER TABLE products
ADD COLUMN size TEXT,
ADD COLUMN unit_type TEXT CHECK (unit_type IN ('ml', 'grams', 'liters', 'kg', 'pieces', 'boxes')),
ADD COLUMN requires_packaging BOOLEAN DEFAULT false,
ADD COLUMN packaging_metadata JSONB DEFAULT '{}';

-- 1.2: Create packaging_items table
CREATE TABLE packaging_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  sku TEXT UNIQUE NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('bottle', 'box', 'label', 'cap', 'bag', 'wrapper', 'other')),
  size TEXT,
  material TEXT,
  cost NUMERIC NOT NULL DEFAULT 0,
  reorder_level INTEGER NOT NULL DEFAULT 50,
  current_stock INTEGER NOT NULL DEFAULT 0,
  supplier_id UUID REFERENCES suppliers(id),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE packaging_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view packaging items"
  ON packaging_items FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Managers can manage packaging items"
  ON packaging_items FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role IN ('super_admin', 'super_manager', 'warehouse_manager')
      AND user_roles.is_active = true
    )
  );

CREATE TRIGGER update_packaging_items_updated_at
  BEFORE UPDATE ON packaging_items
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- 1.3: Create product_packaging junction table
CREATE TABLE product_packaging (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  packaging_item_id UUID NOT NULL REFERENCES packaging_items(id) ON DELETE CASCADE,
  quantity_required INTEGER NOT NULL DEFAULT 1,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(product_id, packaging_item_id)
);

ALTER TABLE product_packaging ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view product packaging"
  ON product_packaging FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Managers can manage product packaging"
  ON product_packaging FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role IN ('super_admin', 'super_manager', 'warehouse_manager')
      AND user_roles.is_active = true
    )
  );

-- 1.4: Enhance suppliers table
ALTER TABLE suppliers
ADD COLUMN IF NOT EXISTS whatsapp_number TEXT,
ADD COLUMN IF NOT EXISTS notification_preferences JSONB DEFAULT '{"email": true, "whatsapp": true}',
ADD COLUMN IF NOT EXISTS lead_time_days INTEGER DEFAULT 7,
ADD COLUMN IF NOT EXISTS minimum_order_value NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS payment_terms TEXT DEFAULT 'Net 30';

-- 1.5: Create supplier_products table
CREATE TABLE supplier_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id UUID NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id) ON DELETE CASCADE,
  packaging_item_id UUID REFERENCES packaging_items(id) ON DELETE CASCADE,
  unit_cost NUMERIC NOT NULL DEFAULT 0,
  minimum_order_quantity INTEGER DEFAULT 1,
  is_primary_supplier BOOLEAN DEFAULT false,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT supplier_products_check 
    CHECK ((product_id IS NOT NULL AND packaging_item_id IS NULL) 
        OR (product_id IS NULL AND packaging_item_id IS NOT NULL))
);

ALTER TABLE supplier_products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view supplier products"
  ON supplier_products FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Managers can manage supplier products"
  ON supplier_products FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role IN ('super_admin', 'super_manager', 'warehouse_manager')
      AND user_roles.is_active = true
    )
  );

CREATE TRIGGER update_supplier_products_updated_at
  BEFORE UPDATE ON supplier_products
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- 1.6: Create supplier_profiles table
CREATE TABLE supplier_profiles (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  supplier_id UUID NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  can_view_inventory BOOLEAN DEFAULT true,
  can_accept_orders BOOLEAN DEFAULT true,
  can_view_analytics BOOLEAN DEFAULT false,
  last_login TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE supplier_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Suppliers can view own profile"
  ON supplier_profiles FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage supplier profiles"
  ON supplier_profiles FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = 'super_admin'
      AND user_roles.is_active = true
    )
  );

CREATE TRIGGER update_supplier_profiles_updated_at
  BEFORE UPDATE ON supplier_profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Create security definer function for checking supplier role
CREATE OR REPLACE FUNCTION public.is_supplier(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = _user_id
    AND role = 'supplier'
    AND is_active = true
  );
$$;

-- 1.7: Create low_stock_notifications table
CREATE TABLE low_stock_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID REFERENCES products(id),
  packaging_item_id UUID REFERENCES packaging_items(id),
  supplier_id UUID NOT NULL REFERENCES suppliers(id),
  notification_type TEXT NOT NULL CHECK (notification_type IN ('email', 'whatsapp', 'both')),
  current_stock INTEGER NOT NULL,
  reorder_level INTEGER NOT NULL,
  suggested_quantity INTEGER NOT NULL,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  response_received BOOLEAN DEFAULT false,
  response_at TIMESTAMPTZ,
  po_created UUID REFERENCES purchase_orders(id),
  metadata JSONB DEFAULT '{}',
  CONSTRAINT low_stock_notifications_check
    CHECK ((product_id IS NOT NULL AND packaging_item_id IS NULL)
        OR (product_id IS NULL AND packaging_item_id IS NOT NULL))
);

ALTER TABLE low_stock_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Managers can view all notifications"
  ON low_stock_notifications FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role IN ('super_admin', 'super_manager', 'warehouse_manager')
      AND user_roles.is_active = true
    )
  );

CREATE POLICY "Suppliers can view their notifications"
  ON low_stock_notifications FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM supplier_profiles
      WHERE supplier_profiles.user_id = auth.uid()
      AND supplier_profiles.supplier_id = low_stock_notifications.supplier_id
    )
  );

CREATE POLICY "System can create notifications"
  ON low_stock_notifications FOR INSERT
  WITH CHECK (true);