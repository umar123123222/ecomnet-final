-- Phase 1: Create all missing core tables for inventory system

-- 1. Create products table (new, properly structured)
CREATE TABLE IF NOT EXISTS public.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sku TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT,
  price NUMERIC(10, 2) NOT NULL,
  cost NUMERIC(10, 2),
  reorder_level INTEGER NOT NULL DEFAULT 10,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Create outlets table (warehouses and retail locations)
CREATE TABLE IF NOT EXISTS public.outlets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  outlet_type TEXT NOT NULL CHECK (outlet_type IN ('warehouse', 'retail')),
  address TEXT,
  city TEXT,
  phone TEXT,
  manager_id UUID REFERENCES public.profiles(id),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Create inventory table (stock levels per product per outlet)
CREATE TABLE IF NOT EXISTS public.inventory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  outlet_id UUID NOT NULL REFERENCES public.outlets(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL DEFAULT 0,
  reserved_quantity INTEGER NOT NULL DEFAULT 0,
  available_quantity INTEGER GENERATED ALWAYS AS (quantity - reserved_quantity) STORED,
  last_restocked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(product_id, outlet_id)
);

-- 4. Create stock_movements table (audit trail for all stock changes)
CREATE TABLE IF NOT EXISTS public.stock_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  outlet_id UUID NOT NULL REFERENCES public.outlets(id) ON DELETE CASCADE,
  movement_type TEXT NOT NULL CHECK (movement_type IN ('sale', 'purchase', 'adjustment', 'transfer_in', 'transfer_out', 'return')),
  quantity INTEGER NOT NULL,
  reference_id UUID,
  notes TEXT,
  created_by UUID NOT NULL REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 5. Create stock_transfer_requests table
CREATE TABLE IF NOT EXISTS public.stock_transfer_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_outlet_id UUID NOT NULL REFERENCES public.outlets(id) ON DELETE RESTRICT,
  to_outlet_id UUID NOT NULL REFERENCES public.outlets(id) ON DELETE RESTRICT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'in_transit', 'completed', 'rejected', 'cancelled')),
  requested_by UUID NOT NULL REFERENCES public.profiles(id),
  approved_by UUID REFERENCES public.profiles(id),
  completed_by UUID REFERENCES public.profiles(id),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 6. Create stock_transfer_items table (items in each transfer request)
CREATE TABLE IF NOT EXISTS public.stock_transfer_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transfer_id UUID NOT NULL REFERENCES public.stock_transfer_requests(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
  quantity_requested INTEGER NOT NULL,
  quantity_approved INTEGER,
  quantity_received INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_inventory_product ON public.inventory(product_id);
CREATE INDEX IF NOT EXISTS idx_inventory_outlet ON public.inventory(outlet_id);
CREATE INDEX IF NOT EXISTS idx_inventory_available ON public.inventory(available_quantity);
CREATE INDEX IF NOT EXISTS idx_stock_movements_product ON public.stock_movements(product_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_outlet ON public.stock_movements(outlet_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_created_at ON public.stock_movements(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_stock_transfer_requests_status ON public.stock_transfer_requests(status);
CREATE INDEX IF NOT EXISTS idx_stock_transfer_items_transfer ON public.stock_transfer_items(transfer_id);
CREATE INDEX IF NOT EXISTS idx_products_sku ON public.products(sku);
CREATE INDEX IF NOT EXISTS idx_products_active ON public.products(is_active);

-- Add triggers for updated_at columns
CREATE TRIGGER update_products_updated_at
  BEFORE UPDATE ON public.products
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_outlets_updated_at
  BEFORE UPDATE ON public.outlets
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_inventory_updated_at
  BEFORE UPDATE ON public.inventory
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_stock_transfer_requests_updated_at
  BEFORE UPDATE ON public.stock_transfer_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Enable Row Level Security
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.outlets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_transfer_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_transfer_items ENABLE ROW LEVEL SECURITY;

-- RLS Policies for products
CREATE POLICY "Authenticated users can view products"
  ON public.products FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Managers can manage products"
  ON public.products FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
      AND role IN ('super_admin', 'super_manager', 'warehouse_manager')
    )
  );

-- RLS Policies for outlets
CREATE POLICY "Authenticated users can view outlets"
  ON public.outlets FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Managers can manage outlets"
  ON public.outlets FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
      AND role IN ('super_admin', 'super_manager')
    )
  );

-- RLS Policies for inventory
CREATE POLICY "Authenticated users can view inventory"
  ON public.inventory FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Warehouse staff can manage inventory"
  ON public.inventory FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
      AND role IN ('super_admin', 'super_manager', 'warehouse_manager', 'staff')
    )
  );

-- RLS Policies for stock_movements
CREATE POLICY "Authenticated users can view stock movements"
  ON public.stock_movements FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Staff can create stock movements"
  ON public.stock_movements FOR INSERT
  WITH CHECK (auth.uid() = created_by);

-- RLS Policies for stock_transfer_requests
CREATE POLICY "Authenticated users can view transfer requests"
  ON public.stock_transfer_requests FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Staff can create transfer requests"
  ON public.stock_transfer_requests FOR INSERT
  WITH CHECK (auth.uid() = requested_by);

CREATE POLICY "Managers can manage transfer requests"
  ON public.stock_transfer_requests FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
      AND role IN ('super_admin', 'super_manager', 'warehouse_manager')
    )
  );

-- RLS Policies for stock_transfer_items
CREATE POLICY "Authenticated users can view transfer items"
  ON public.stock_transfer_items FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Staff can manage transfer items"
  ON public.stock_transfer_items FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.stock_transfer_requests str
      WHERE str.id = stock_transfer_items.transfer_id
      AND (str.requested_by = auth.uid() OR EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid()
        AND role IN ('super_admin', 'super_manager', 'warehouse_manager')
      ))
    )
  );

-- Migrate data from old product table to new products table
INSERT INTO public.products (sku, name, price, category, is_active, created_at)
SELECT 
  COALESCE(shopify_id::text, 'SKU-' || id::text) as sku,
  COALESCE(name, 'Unnamed Product') as name,
  COALESCE(price::numeric, 0) as price,
  type as category,
  true as is_active,
  now() as created_at
FROM public.product
WHERE NOT EXISTS (
  SELECT 1 FROM public.products p WHERE p.sku = COALESCE(product.shopify_id::text, 'SKU-' || product.id::text)
)
ON CONFLICT (sku) DO NOTHING;

-- Create seed outlets (1 main warehouse, 1 retail store)
INSERT INTO public.outlets (name, outlet_type, city, is_active)
VALUES 
  ('Main Warehouse', 'warehouse', 'Karachi', true),
  ('Retail Store - Downtown', 'retail', 'Lahore', true)
ON CONFLICT DO NOTHING;

-- Initialize inventory for migrated products in main warehouse
INSERT INTO public.inventory (product_id, outlet_id, quantity, reserved_quantity)
SELECT 
  p.id,
  (SELECT id FROM public.outlets WHERE outlet_type = 'warehouse' LIMIT 1),
  0,
  0
FROM public.products p
WHERE NOT EXISTS (
  SELECT 1 FROM public.inventory i WHERE i.product_id = p.id
)
ON CONFLICT (product_id, outlet_id) DO NOTHING;