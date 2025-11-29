-- Phase 1: Create Product Variants Structure
CREATE TABLE IF NOT EXISTS public.product_variants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  variant_name TEXT NOT NULL,
  variant_type TEXT, -- 'size', 'color', 'material', etc.
  sku TEXT UNIQUE NOT NULL,
  barcode TEXT,
  price_adjustment NUMERIC DEFAULT 0,
  cost_adjustment NUMERIC DEFAULT 0,
  shopify_variant_id BIGINT UNIQUE,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Add product and variant references to order_items
ALTER TABLE public.order_items 
  ADD COLUMN IF NOT EXISTS product_id UUID REFERENCES public.products(id),
  ADD COLUMN IF NOT EXISTS variant_id UUID REFERENCES public.product_variants(id);

-- Create Product Packaging Requirements table
CREATE TABLE IF NOT EXISTS public.product_packaging_requirements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  variant_id UUID REFERENCES public.product_variants(id) ON DELETE CASCADE,
  packaging_item_id UUID NOT NULL REFERENCES public.packaging_items(id) ON DELETE CASCADE,
  quantity_required INTEGER NOT NULL DEFAULT 1 CHECK (quantity_required > 0),
  is_required BOOLEAN DEFAULT true,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(product_id, variant_id, packaging_item_id)
);

-- Add variant support to inventory
ALTER TABLE public.inventory
  ADD COLUMN IF NOT EXISTS variant_id UUID REFERENCES public.product_variants(id);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_product_variants_product_id ON public.product_variants(product_id);
CREATE INDEX IF NOT EXISTS idx_product_variants_sku ON public.product_variants(sku);
CREATE INDEX IF NOT EXISTS idx_product_variants_shopify_variant_id ON public.product_variants(shopify_variant_id);
CREATE INDEX IF NOT EXISTS idx_order_items_product_id ON public.order_items(product_id);
CREATE INDEX IF NOT EXISTS idx_order_items_variant_id ON public.order_items(variant_id);
CREATE INDEX IF NOT EXISTS idx_inventory_variant_id ON public.inventory(variant_id);
CREATE INDEX IF NOT EXISTS idx_product_packaging_requirements_product_id ON public.product_packaging_requirements(product_id);

-- Phase 2: Create Stock Summary Views
CREATE OR REPLACE VIEW public.product_stock_summary AS
SELECT 
  p.id as product_id,
  p.name,
  p.sku,
  p.price,
  p.cost,
  COALESCE(SUM(i.quantity), 0) as total_stock,
  COALESCE(SUM(i.reserved_quantity), 0) as committed_stock,
  COALESCE(SUM(i.available_quantity), 0) as available_stock,
  COUNT(DISTINCT i.outlet_id) as outlet_count,
  COALESCE(SUM(i.quantity * p.price), 0) as total_value
FROM public.products p
LEFT JOIN public.inventory i ON i.product_id = p.id
WHERE p.is_active = true
GROUP BY p.id, p.name, p.sku, p.price, p.cost;

CREATE OR REPLACE VIEW public.outlet_stock_summary AS
SELECT 
  o.id as outlet_id,
  o.name as outlet_name,
  o.outlet_type,
  COUNT(DISTINCT i.product_id) as product_count,
  COALESCE(SUM(i.quantity), 0) as total_units,
  COALESCE(SUM(i.reserved_quantity), 0) as reserved_units,
  COALESCE(SUM(i.available_quantity), 0) as available_units,
  COALESCE(SUM(i.quantity * p.price), 0) as total_value
FROM public.outlets o
LEFT JOIN public.inventory i ON i.outlet_id = o.id
LEFT JOIN public.products p ON p.id = i.product_id
WHERE o.is_active = true
GROUP BY o.id, o.name, o.outlet_type;

-- Create function to update reserved quantity based on actual orders
CREATE OR REPLACE FUNCTION public.calculate_reserved_quantity(p_product_id UUID, p_outlet_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_reserved INTEGER;
BEGIN
  -- Calculate reserved quantity from pending orders
  SELECT COALESCE(SUM(oi.quantity), 0)
  INTO v_reserved
  FROM order_items oi
  JOIN orders o ON o.id = oi.order_id
  WHERE oi.product_id = p_product_id
    AND o.outlet_id = p_outlet_id
    AND o.status IN ('pending', 'confirmed', 'booked', 'pending_confirmation', 'pending_address', 'pending_dispatch');
  
  RETURN v_reserved;
END;
$$;

-- Trigger to auto-update reserved quantity when orders change
CREATE OR REPLACE FUNCTION public.update_inventory_reserved_on_order_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Update inventory for affected products
  IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
    UPDATE inventory
    SET reserved_quantity = calculate_reserved_quantity(NEW.product_id, (SELECT outlet_id FROM orders WHERE id = NEW.order_id))
    WHERE product_id = NEW.product_id
      AND outlet_id = (SELECT outlet_id FROM orders WHERE id = NEW.order_id);
  END IF;
  
  IF TG_OP = 'DELETE' OR TG_OP = 'UPDATE' THEN
    UPDATE inventory
    SET reserved_quantity = calculate_reserved_quantity(OLD.product_id, (SELECT outlet_id FROM orders WHERE id = OLD.order_id))
    WHERE product_id = OLD.product_id
      AND outlet_id = (SELECT outlet_id FROM orders WHERE id = OLD.order_id);
  END IF;
  
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_update_reserved_on_order_items ON public.order_items;
CREATE TRIGGER trigger_update_reserved_on_order_items
  AFTER INSERT OR UPDATE OR DELETE ON public.order_items
  FOR EACH ROW
  EXECUTE FUNCTION public.update_inventory_reserved_on_order_change();

-- Trigger to update reserved quantity when order status changes
CREATE OR REPLACE FUNCTION public.update_inventory_reserved_on_order_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only recalculate if status changed to/from reservation statuses
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    -- Update all products in this order
    UPDATE inventory i
    SET reserved_quantity = calculate_reserved_quantity(oi.product_id, NEW.outlet_id)
    FROM order_items oi
    WHERE oi.order_id = NEW.id
      AND i.product_id = oi.product_id
      AND i.outlet_id = NEW.outlet_id;
  END IF;
  
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_update_reserved_on_order_status ON public.orders;
CREATE TRIGGER trigger_update_reserved_on_order_status
  AFTER UPDATE ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.update_inventory_reserved_on_order_status_change();

-- Enable RLS on new tables
ALTER TABLE public.product_variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_packaging_requirements ENABLE ROW LEVEL SECURITY;

-- RLS Policies for product_variants
CREATE POLICY "Authenticated users can view variants"
  ON public.product_variants FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Managers can manage variants"
  ON public.product_variants FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
        AND role IN ('super_admin', 'super_manager', 'warehouse_manager', 'store_manager')
        AND is_active = true
    )
  );

-- RLS Policies for product_packaging_requirements
CREATE POLICY "Authenticated users can view packaging requirements"
  ON public.product_packaging_requirements FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Managers can manage packaging requirements"
  ON public.product_packaging_requirements FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
        AND role IN ('super_admin', 'super_manager', 'warehouse_manager')
        AND is_active = true
    )
  );

-- Create trigger for updated_at on new tables
CREATE TRIGGER update_product_variants_updated_at
  BEFORE UPDATE ON public.product_variants
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_product_packaging_requirements_updated_at
  BEFORE UPDATE ON public.product_packaging_requirements
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();