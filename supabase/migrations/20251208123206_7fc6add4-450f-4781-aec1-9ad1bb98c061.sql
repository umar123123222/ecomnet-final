-- Phase 1: Create inventory records for all active products in Main Warehouse
DO $$
DECLARE
  v_main_warehouse_id UUID;
BEGIN
  SELECT id INTO v_main_warehouse_id 
  FROM outlets 
  WHERE outlet_type = 'warehouse' 
  ORDER BY created_at ASC
  LIMIT 1;

  INSERT INTO inventory (product_id, outlet_id, quantity, reserved_quantity)
  SELECT 
    p.id,
    v_main_warehouse_id,
    0,
    0
  FROM products p
  WHERE p.is_active = true
    AND NOT EXISTS (
      SELECT 1 FROM inventory i 
      WHERE i.product_id = p.id 
      AND i.outlet_id = v_main_warehouse_id
    );
    
  RAISE NOTICE 'Created inventory records for products in warehouse %', v_main_warehouse_id;
END $$;

-- Phase 2: Create function to calculate reserved quantity including bundle expansion
CREATE OR REPLACE FUNCTION public.calculate_reserved_quantity_with_bundles(p_product_id uuid, p_outlet_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_direct_reserved INTEGER := 0;
  v_bundle_reserved INTEGER := 0;
BEGIN
  SELECT COALESCE(SUM(oi.quantity), 0)
  INTO v_direct_reserved
  FROM order_items oi
  JOIN orders o ON o.id = oi.order_id
  WHERE oi.product_id = p_product_id
    AND o.status IN ('pending', 'confirmed', 'booked');

  SELECT COALESCE(SUM(oi.quantity * pbi.quantity), 0)
  INTO v_bundle_reserved
  FROM order_items oi
  JOIN orders o ON o.id = oi.order_id
  JOIN product_bundle_items pbi ON pbi.bundle_product_id = oi.product_id
  WHERE pbi.component_product_id = p_product_id
    AND o.status IN ('pending', 'confirmed', 'booked');

  RETURN v_direct_reserved + v_bundle_reserved;
END;
$function$;

-- Phase 3: Temporarily disable validation triggers
ALTER TABLE inventory DISABLE TRIGGER trigger_validate_inventory_quantities;
ALTER TABLE inventory DISABLE TRIGGER validate_inventory_reservation;

-- Phase 3b: Update reserved quantities
DO $$
DECLARE
  v_main_warehouse_id UUID;
  v_inv RECORD;
  v_new_reserved INTEGER;
BEGIN
  SELECT id INTO v_main_warehouse_id 
  FROM outlets 
  WHERE outlet_type = 'warehouse' 
  ORDER BY created_at ASC
  LIMIT 1;

  FOR v_inv IN 
    SELECT id, product_id, outlet_id, quantity
    FROM inventory 
    WHERE outlet_id = v_main_warehouse_id
  LOOP
    v_new_reserved := calculate_reserved_quantity_with_bundles(v_inv.product_id, v_inv.outlet_id);
    
    UPDATE inventory 
    SET 
      reserved_quantity = v_new_reserved,
      updated_at = now()
    WHERE id = v_inv.id;
  END LOOP;
  
  RAISE NOTICE 'Updated reserved quantities for all inventory records';
END $$;

-- Phase 3c: Re-enable validation triggers
ALTER TABLE inventory ENABLE TRIGGER trigger_validate_inventory_quantities;
ALTER TABLE inventory ENABLE TRIGGER validate_inventory_reservation;

-- Phase 4: Replace the old calculate_reserved_quantity function
CREATE OR REPLACE FUNCTION public.calculate_reserved_quantity(p_product_id uuid, p_outlet_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  RETURN calculate_reserved_quantity_with_bundles(p_product_id, p_outlet_id);
END;
$function$;