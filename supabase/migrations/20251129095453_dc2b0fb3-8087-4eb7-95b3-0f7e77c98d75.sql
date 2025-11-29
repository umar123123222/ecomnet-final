-- Fix: Update trigger function to use main warehouse instead of NEW.outlet_id
CREATE OR REPLACE FUNCTION public.update_inventory_reserved_on_order_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_main_warehouse_id UUID;
BEGIN
  -- Get main warehouse ID
  SELECT id INTO v_main_warehouse_id 
  FROM outlets 
  WHERE outlet_type = 'warehouse' 
  ORDER BY created_at ASC
  LIMIT 1;
  
  -- Skip if no warehouse found
  IF v_main_warehouse_id IS NULL THEN
    RETURN NEW;
  END IF;
  
  -- Only recalculate if status changed to/from reservation statuses
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    -- Update all products in this order using main warehouse
    UPDATE inventory i
    SET reserved_quantity = calculate_reserved_quantity(oi.product_id, v_main_warehouse_id)
    FROM order_items oi
    WHERE oi.order_id = NEW.id
      AND i.product_id = oi.product_id
      AND i.outlet_id = v_main_warehouse_id;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Fix: Update calculate_reserved_quantity to not depend on orders.outlet_id
CREATE OR REPLACE FUNCTION public.calculate_reserved_quantity(p_product_id UUID, p_outlet_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_reserved INTEGER;
BEGIN
  -- Calculate reserved quantity from pending/confirmed/booked orders
  -- Note: orders table does not have outlet_id, so we calculate for all pending orders
  SELECT COALESCE(SUM(oi.quantity), 0)
  INTO v_reserved
  FROM order_items oi
  JOIN orders o ON o.id = oi.order_id
  WHERE oi.product_id = p_product_id
    AND o.status IN ('pending', 'confirmed', 'booked', 'pending_confirmation', 'pending_address', 'pending_dispatch');
  
  RETURN v_reserved;
END;
$$;