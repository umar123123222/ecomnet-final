-- Create outlet_packaging_inventory table
CREATE TABLE public.outlet_packaging_inventory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  outlet_id UUID NOT NULL REFERENCES outlets(id) ON DELETE CASCADE,
  packaging_item_id UUID NOT NULL REFERENCES packaging_items(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL DEFAULT 0,
  last_restocked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(outlet_id, packaging_item_id)
);

-- Enable RLS
ALTER TABLE public.outlet_packaging_inventory ENABLE ROW LEVEL SECURITY;

-- Store managers can view their outlet's packaging
CREATE POLICY "Store managers can view their outlet packaging"
  ON public.outlet_packaging_inventory FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM outlet_staff WHERE user_id = auth.uid() AND outlet_id = outlet_packaging_inventory.outlet_id
    ) OR
    EXISTS (
      SELECT 1 FROM outlets WHERE id = outlet_packaging_inventory.outlet_id AND manager_id = auth.uid()
    ) OR
    EXISTS (
      SELECT 1 FROM user_roles WHERE user_id = auth.uid() 
        AND role IN ('super_admin', 'super_manager', 'warehouse_manager') 
        AND is_active = true
    )
  );

-- Store managers can update their outlet's packaging (for damage reporting)
CREATE POLICY "Store managers can update their outlet packaging"
  ON public.outlet_packaging_inventory FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM outlet_staff WHERE user_id = auth.uid() AND outlet_id = outlet_packaging_inventory.outlet_id
    ) OR
    EXISTS (
      SELECT 1 FROM outlets WHERE id = outlet_packaging_inventory.outlet_id AND manager_id = auth.uid()
    ) OR
    EXISTS (
      SELECT 1 FROM user_roles WHERE user_id = auth.uid() 
        AND role IN ('super_admin', 'super_manager', 'warehouse_manager') 
        AND is_active = true
    )
  );

-- Managers can manage all outlet packaging
CREATE POLICY "Managers can manage outlet packaging"
  ON public.outlet_packaging_inventory FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_roles WHERE user_id = auth.uid() 
        AND role IN ('super_admin', 'super_manager', 'warehouse_manager') 
        AND is_active = true
    )
  );

-- Create helper function to upsert outlet packaging inventory
CREATE OR REPLACE FUNCTION public.upsert_outlet_packaging_inventory(
  p_outlet_id UUID,
  p_packaging_item_id UUID,
  p_quantity_change INTEGER
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO outlet_packaging_inventory (outlet_id, packaging_item_id, quantity, last_restocked_at)
  VALUES (p_outlet_id, p_packaging_item_id, p_quantity_change, now())
  ON CONFLICT (outlet_id, packaging_item_id)
  DO UPDATE SET 
    quantity = outlet_packaging_inventory.quantity + p_quantity_change,
    last_restocked_at = now(),
    updated_at = now();
END;
$$;

-- Create index for performance
CREATE INDEX idx_outlet_packaging_inventory_outlet ON public.outlet_packaging_inventory(outlet_id);
CREATE INDEX idx_outlet_packaging_inventory_packaging ON public.outlet_packaging_inventory(packaging_item_id);