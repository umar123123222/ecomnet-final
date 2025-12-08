-- Update rapid_dispatch_order function to allow negative inventory
CREATE OR REPLACE FUNCTION public.rapid_dispatch_order(p_entry text, p_user_id uuid, p_courier_id uuid DEFAULT NULL::uuid, p_courier_name text DEFAULT NULL::text, p_courier_code text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_order RECORD;
  v_dispatch_id UUID;
  v_final_courier_name TEXT;
  v_final_courier_code TEXT;
  v_match_type TEXT;
  v_packaging_result JSONB;
  v_packaging_warning TEXT := NULL;
  v_order_item RECORD;
  v_inventory RECORD;
  v_bundle_item RECORD;
  v_deduct_qty INTEGER;
  v_main_warehouse_id UUID;
BEGIN
  -- Get main warehouse ID
  SELECT id INTO v_main_warehouse_id 
  FROM outlets 
  WHERE outlet_type = 'warehouse' 
  ORDER BY created_at ASC
  LIMIT 1;

  -- Try exact match lookup (uses indexes - fast!)
  SELECT 
    o.id, o.tracking_id, o.order_number, o.shopify_order_number,
    o.customer_name, o.total_amount, o.courier, o.status,
    d.id as existing_dispatch_id
  INTO v_order
  FROM orders o
  LEFT JOIN dispatches d ON d.order_id = o.id
  WHERE 
    o.tracking_id = p_entry OR
    o.order_number = p_entry OR
    o.order_number = 'SHOP-' || p_entry OR
    o.shopify_order_number = p_entry OR
    o.shopify_order_number = '#' || p_entry
  LIMIT 1;

  -- Order not found
  IF v_order.id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'errorCode', 'NOT_FOUND',
      'error', 'Order not found'
    );
  END IF;

  -- Already dispatched
  IF v_order.existing_dispatch_id IS NOT NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'errorCode', 'ALREADY_DISPATCHED',
      'error', 'Order already dispatched',
      'order', jsonb_build_object(
        'id', v_order.id,
        'order_number', v_order.order_number,
        'customer_name', v_order.customer_name,
        'total_amount', v_order.total_amount,
        'status', v_order.status
      )
    );
  END IF;

  -- Determine courier name
  IF p_courier_name IS NOT NULL THEN
    v_final_courier_name := p_courier_name;
  ELSIF v_order.courier IS NOT NULL THEN
    SELECT name INTO v_final_courier_name 
    FROM couriers 
    WHERE LOWER(code) = LOWER(v_order.courier::text) 
    LIMIT 1;
    v_final_courier_name := COALESCE(v_final_courier_name, v_order.courier::text);
  ELSE
    v_final_courier_name := 'Unknown';
  END IF;

  v_final_courier_code := COALESCE(p_courier_code, v_order.courier::text, 'unknown');

  -- Determine match type
  IF v_order.tracking_id = p_entry THEN
    v_match_type := 'tracking_id';
  ELSE
    v_match_type := 'order_number';
  END IF;

  -- ============ DEDUCT PRODUCT INVENTORY (ALLOW NEGATIVE) ============
  IF v_main_warehouse_id IS NOT NULL THEN
    FOR v_order_item IN
      SELECT oi.*, p.id as product_id, p.is_bundle, p.name as product_name
      FROM order_items oi
      LEFT JOIN products p ON p.id = oi.product_id OR p.name ILIKE '%' || oi.item_name || '%'
      WHERE oi.order_id = v_order.id
    LOOP
      IF v_order_item.product_id IS NULL THEN
        CONTINUE;
      END IF;

      IF v_order_item.is_bundle THEN
        -- BUNDLE: Deduct each component (allow negative)
        FOR v_bundle_item IN
          SELECT pbi.component_product_id, pbi.quantity, p.name as component_name
          FROM product_bundle_items pbi
          JOIN products p ON p.id = pbi.component_product_id
          WHERE pbi.bundle_product_id = v_order_item.product_id
        LOOP
          v_deduct_qty := v_bundle_item.quantity * v_order_item.quantity;
          
          SELECT * INTO v_inventory
          FROM inventory
          WHERE product_id = v_bundle_item.component_product_id
            AND outlet_id = v_main_warehouse_id;

          IF v_inventory.id IS NOT NULL THEN
            -- Allow negative inventory
            UPDATE inventory
            SET 
              quantity = quantity - v_deduct_qty,
              reserved_quantity = GREATEST(0, reserved_quantity - v_deduct_qty)
            WHERE id = v_inventory.id;

            -- Create stock movement
            INSERT INTO stock_movements (product_id, outlet_id, movement_type, quantity, reference_id, created_by, notes)
            VALUES (v_bundle_item.component_product_id, v_main_warehouse_id, 'sale', -v_deduct_qty, v_order.id, p_user_id, 
              'Bundle dispatch: ' || v_order_item.item_name || ' -> ' || v_bundle_item.component_name);
          END IF;
        END LOOP;
      ELSE
        -- REGULAR PRODUCT: Deduct inventory (allow negative)
        SELECT * INTO v_inventory
        FROM inventory
        WHERE product_id = v_order_item.product_id
          AND outlet_id = v_main_warehouse_id;

        IF v_inventory.id IS NOT NULL THEN
          -- Allow negative inventory
          UPDATE inventory
          SET 
            quantity = quantity - v_order_item.quantity,
            reserved_quantity = GREATEST(0, reserved_quantity - v_order_item.quantity)
          WHERE id = v_inventory.id;

          -- Create stock movement
          INSERT INTO stock_movements (product_id, outlet_id, movement_type, quantity, reference_id, created_by, notes)
          VALUES (v_order_item.product_id, v_main_warehouse_id, 'sale', -v_order_item.quantity, v_order.id, p_user_id, 
            'Order dispatch: ' || v_order.order_number);
        END IF;
      END IF;
    END LOOP;
  END IF;

  -- ============ DEDUCT PACKAGING ============
  SELECT deduct_order_packaging(v_order.id, p_user_id) INTO v_packaging_result;
  
  IF v_packaging_result IS NOT NULL AND v_packaging_result->'warnings' IS NOT NULL THEN
    SELECT string_agg(w::text, '; ') INTO v_packaging_warning
    FROM jsonb_array_elements_text(v_packaging_result->'warnings') w;
  END IF;

  -- ============ CREATE DISPATCH RECORD ============
  INSERT INTO dispatches (
    order_id, 
    courier, 
    courier_id,
    tracking_id, 
    dispatch_date, 
    dispatched_by
  ) VALUES (
    v_order.id,
    v_final_courier_name,
    p_courier_id,
    v_order.tracking_id,
    NOW(),
    p_user_id
  )
  RETURNING id INTO v_dispatch_id;

  -- ============ UPDATE ORDER STATUS ============
  UPDATE orders
  SET 
    status = 'dispatched',
    dispatched_at = NOW()
  WHERE id = v_order.id;

  RETURN jsonb_build_object(
    'success', true,
    'order_id', v_order.id,
    'order_number', v_order.order_number,
    'customer_name', v_order.customer_name,
    'total_amount', v_order.total_amount,
    'courier', v_final_courier_name,
    'match_type', v_match_type,
    'dispatch_id', v_dispatch_id,
    'packaging_warning', v_packaging_warning,
    'packaging_deductions', COALESCE(v_packaging_result->'deductions', '[]'::jsonb)
  );
END;
$function$;

-- Update validate_inventory_quantities trigger to allow negative quantities
CREATE OR REPLACE FUNCTION public.validate_inventory_quantities()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Allow negative quantities - only ensure reserved_quantity is not negative
  IF NEW.reserved_quantity < 0 THEN
    NEW.reserved_quantity := 0;
  END IF;
  
  RETURN NEW;
END;
$function$;

-- Update check_inventory_consistency trigger to allow negative inventory
CREATE OR REPLACE FUNCTION public.check_inventory_consistency()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  -- Prevent negative reserved quantity only
  IF NEW.reserved_quantity < 0 THEN
    NEW.reserved_quantity := 0;
  END IF;
  
  -- Allow negative total quantity (oversold inventory)
  
  RETURN NEW;
END;
$function$;