-- Phase 4: Database Schema Fixes for Warehouse Manager Inventory Management

-- Trigger 1: Auto-calculate available_quantity in inventory table
CREATE OR REPLACE FUNCTION public.update_inventory_available_quantity()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Auto-calculate available quantity as: quantity - reserved_quantity
  NEW.available_quantity := NEW.quantity - NEW.reserved_quantity;
  RETURN NEW;
END;
$$;

-- Drop trigger if exists and recreate
DROP TRIGGER IF EXISTS trigger_update_inventory_available_quantity ON public.inventory;

CREATE TRIGGER trigger_update_inventory_available_quantity
  BEFORE INSERT OR UPDATE ON public.inventory
  FOR EACH ROW
  EXECUTE FUNCTION public.update_inventory_available_quantity();

-- Trigger 2: Validate inventory quantities (prevent invalid states)
CREATE OR REPLACE FUNCTION public.validate_inventory_quantities()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Ensure reserved_quantity doesn't exceed total quantity
  IF NEW.reserved_quantity > NEW.quantity THEN
    RAISE EXCEPTION 'Reserved quantity (%) cannot exceed total quantity (%)', NEW.reserved_quantity, NEW.quantity;
  END IF;
  
  -- Ensure reserved_quantity is not negative
  IF NEW.reserved_quantity < 0 THEN
    RAISE EXCEPTION 'Reserved quantity cannot be negative';
  END IF;
  
  RETURN NEW;
END;
$$;

-- Drop trigger if exists and recreate
DROP TRIGGER IF EXISTS trigger_validate_inventory_quantities ON public.inventory;

CREATE TRIGGER trigger_validate_inventory_quantities
  BEFORE INSERT OR UPDATE ON public.inventory
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_inventory_quantities();

-- Create packaging_stock_movements table for better tracking
CREATE TABLE IF NOT EXISTS public.packaging_stock_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  packaging_item_id UUID NOT NULL REFERENCES public.packaging_items(id) ON DELETE CASCADE,
  movement_type TEXT NOT NULL CHECK (movement_type IN ('adjustment', 'usage', 'receipt', 'return', 'damage', 'transfer')),
  quantity INTEGER NOT NULL,
  previous_stock INTEGER NOT NULL,
  new_stock INTEGER NOT NULL,
  notes TEXT,
  reference_id UUID,
  performed_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add index for better query performance
CREATE INDEX IF NOT EXISTS idx_packaging_stock_movements_packaging_item 
  ON public.packaging_stock_movements(packaging_item_id);
CREATE INDEX IF NOT EXISTS idx_packaging_stock_movements_created_at 
  ON public.packaging_stock_movements(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_packaging_stock_movements_performed_by 
  ON public.packaging_stock_movements(performed_by);

-- Enable RLS on packaging_stock_movements
ALTER TABLE public.packaging_stock_movements ENABLE ROW LEVEL SECURITY;

-- Policy: Warehouse staff and managers can view all packaging stock movements
CREATE POLICY "Warehouse staff can view packaging stock movements"
  ON public.packaging_stock_movements
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
        AND role IN ('super_admin', 'super_manager', 'warehouse_manager', 'store_manager')
        AND is_active = true
    )
  );

-- Policy: System can insert packaging stock movements
CREATE POLICY "System can insert packaging stock movements"
  ON public.packaging_stock_movements
  FOR INSERT
  TO authenticated
  WITH CHECK (performed_by = auth.uid());

COMMENT ON TABLE public.packaging_stock_movements IS 'Tracks all packaging item stock changes for audit trail';
COMMENT ON COLUMN public.packaging_stock_movements.movement_type IS 'Type of movement: adjustment, usage, receipt, return, damage, transfer';
COMMENT ON COLUMN public.packaging_stock_movements.quantity IS 'Quantity moved (positive or negative)';
COMMENT ON COLUMN public.packaging_stock_movements.previous_stock IS 'Stock level before the movement';
COMMENT ON COLUMN public.packaging_stock_movements.new_stock IS 'Stock level after the movement';