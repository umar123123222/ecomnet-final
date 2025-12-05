-- Create comprehensive packaging deduction function
CREATE OR REPLACE FUNCTION public.deduct_order_packaging(
  p_order_id UUID,
  p_user_id UUID
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_order_item RECORD;
  v_packaging RECORD;
  v_total_items INTEGER := 0;
  v_deductions JSONB := '[]'::JSONB;
  v_warnings TEXT[] := ARRAY[]::TEXT[];
  v_product_ids UUID[];
BEGIN
  -- Get total items in order and collect product IDs
  SELECT 
    COALESCE(SUM(quantity), 0),
    ARRAY_AGG(DISTINCT product_id) FILTER (WHERE product_id IS NOT NULL)
  INTO v_total_items, v_product_ids
  FROM order_items 
  WHERE order_id = p_order_id;

  -- 1. DEDUCT per_product PACKAGING (for each product unit, excluding product_specific)
  FOR v_packaging IN
    SELECT pi.id, pi.name, pi.sku, pi.current_stock, pi.linked_product_ids
    FROM packaging_items pi
    WHERE pi.allocation_type = 'per_product'
      AND pi.is_active = true
  LOOP
    -- Calculate total units needed (1 per product unit)
    DECLARE
      v_units_needed INTEGER := 0;
    BEGIN
      -- Get sum of quantities for products NOT in product_specific packaging
      SELECT COALESCE(SUM(oi.quantity), 0)
      INTO v_units_needed
      FROM order_items oi
      WHERE oi.order_id = p_order_id
        AND oi.product_id IS NOT NULL
        -- Exclude products that have product_specific packaging
        AND NOT EXISTS (
          SELECT 1 FROM packaging_items pi2
          WHERE pi2.allocation_type = 'product_specific'
            AND pi2.is_active = true
            AND oi.product_id = ANY(pi2.linked_product_ids)
        );

      IF v_units_needed > 0 THEN
        IF v_packaging.current_stock >= v_units_needed THEN
          -- Deduct stock
          UPDATE packaging_items
          SET current_stock = current_stock - v_units_needed
          WHERE id = v_packaging.id;

          -- Record usage
          INSERT INTO order_packaging (order_id, packaging_item_id, quantity, auto_selected, selected_by)
          VALUES (p_order_id, v_packaging.id, v_units_needed, true, p_user_id)
          ON CONFLICT DO NOTHING;

          -- Create movement record
          INSERT INTO packaging_movements (packaging_item_id, movement_type, quantity, reference_id, created_by, notes)
          VALUES (v_packaging.id, 'dispatch', -v_units_needed, p_order_id, p_user_id, 'per_product allocation');

          v_deductions := v_deductions || jsonb_build_object(
            'type', 'per_product',
            'packaging_name', v_packaging.name,
            'quantity', v_units_needed
          );
        ELSE
          v_warnings := array_append(v_warnings, 'Low stock: ' || v_packaging.name || ' (need ' || v_units_needed || ', have ' || v_packaging.current_stock || ')');
        END IF;
      END IF;
    END;
  END LOOP;

  -- 2. DEDUCT product_specific PACKAGING (for specific products only)
  FOR v_packaging IN
    SELECT pi.id, pi.name, pi.sku, pi.current_stock, pi.linked_product_ids
    FROM packaging_items pi
    WHERE pi.allocation_type = 'product_specific'
      AND pi.is_active = true
      AND pi.linked_product_ids IS NOT NULL
      AND array_length(pi.linked_product_ids, 1) > 0
  LOOP
    DECLARE
      v_units_needed INTEGER := 0;
    BEGIN
      -- Count how many units of linked products are in this order
      SELECT COALESCE(SUM(oi.quantity), 0)
      INTO v_units_needed
      FROM order_items oi
      WHERE oi.order_id = p_order_id
        AND oi.product_id = ANY(v_packaging.linked_product_ids);

      IF v_units_needed > 0 THEN
        IF v_packaging.current_stock >= v_units_needed THEN
          -- Deduct stock
          UPDATE packaging_items
          SET current_stock = current_stock - v_units_needed
          WHERE id = v_packaging.id;

          -- Record usage
          INSERT INTO order_packaging (order_id, packaging_item_id, quantity, auto_selected, selected_by)
          VALUES (p_order_id, v_packaging.id, v_units_needed, true, p_user_id)
          ON CONFLICT DO NOTHING;

          -- Create movement record
          INSERT INTO packaging_movements (packaging_item_id, movement_type, quantity, reference_id, created_by, notes)
          VALUES (v_packaging.id, 'dispatch', -v_units_needed, p_order_id, p_user_id, 'product_specific allocation');

          v_deductions := v_deductions || jsonb_build_object(
            'type', 'product_specific',
            'packaging_name', v_packaging.name,
            'quantity', v_units_needed
          );
        ELSE
          v_warnings := array_append(v_warnings, 'Low stock: ' || v_packaging.name || ' (need ' || v_units_needed || ', have ' || v_packaging.current_stock || ')');
        END IF;
      END IF;
    END;
  END LOOP;

  -- 3. DEDUCT per_order_rules PACKAGING (based on total items in order)
  FOR v_packaging IN
    SELECT 
      pi.id, pi.name, pi.sku, pi.current_stock,
      1 AS quantity_needed
    FROM order_packaging_rules opr
    JOIN packaging_items pi ON pi.id = opr.packaging_item_id
    WHERE opr.is_active = true
      AND pi.is_active = true
      AND v_total_items BETWEEN opr.min_items AND opr.max_items
    ORDER BY opr.priority DESC, opr.min_items ASC
    LIMIT 1
  LOOP
    IF v_packaging.current_stock >= v_packaging.quantity_needed THEN
      -- Deduct stock
      UPDATE packaging_items
      SET current_stock = current_stock - v_packaging.quantity_needed
      WHERE id = v_packaging.id;

      -- Record usage
      INSERT INTO order_packaging (order_id, packaging_item_id, quantity, auto_selected, selected_by)
      VALUES (p_order_id, v_packaging.id, v_packaging.quantity_needed, true, p_user_id)
      ON CONFLICT DO NOTHING;

      -- Create movement record
      INSERT INTO packaging_movements (packaging_item_id, movement_type, quantity, reference_id, created_by, notes)
      VALUES (v_packaging.id, 'dispatch', -v_packaging.quantity_needed, p_order_id, p_user_id, 'per_order_rules allocation');

      v_deductions := v_deductions || jsonb_build_object(
        'type', 'per_order_rules',
        'packaging_name', v_packaging.name,
        'quantity', v_packaging.quantity_needed
      );
    ELSE
      v_warnings := array_append(v_warnings, 'Low stock: ' || v_packaging.name);
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'deductions', v_deductions,
    'warnings', v_warnings
  );
END;
$$;

-- Update rapid_dispatch_order to deduct product inventory AND packaging
CREATE OR REPLACE FUNCTION public.rapid_dispatch_order(
  p_entry text, 
  p_user_id uuid, 
  p_courier_id uuid DEFAULT NULL::uuid, 
  p_courier_name text DEFAULT NULL::text, 
  p_courier_code text DEFAULT NULL::text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
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

  -- ============ DEDUCT PRODUCT INVENTORY ============
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
        -- BUNDLE: Deduct each component
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
            UPDATE inventory
            SET 
              quantity = GREATEST(0, quantity - v_deduct_qty),
              reserved_quantity = GREATEST(0, reserved_quantity - v_deduct_qty)
            WHERE id = v_inventory.id;

            -- Create stock movement
            INSERT INTO stock_movements (product_id, outlet_id, movement_type, quantity, reference_id, created_by, notes)
            VALUES (v_bundle_item.component_product_id, v_main_warehouse_id, 'sale', -v_deduct_qty, v_order.id, p_user_id, 
                    'Rapid dispatch bundle: ' || v_order_item.item_name || ' -> ' || v_bundle_item.component_name);
          END IF;
        END LOOP;
      ELSE
        -- REGULAR PRODUCT: Direct deduction
        SELECT * INTO v_inventory
        FROM inventory
        WHERE product_id = v_order_item.product_id
          AND outlet_id = v_main_warehouse_id;

        IF v_inventory.id IS NOT NULL THEN
          UPDATE inventory
          SET 
            quantity = GREATEST(0, quantity - v_order_item.quantity),
            reserved_quantity = GREATEST(0, reserved_quantity - v_order_item.quantity)
          WHERE id = v_inventory.id;

          -- Create stock movement
          INSERT INTO stock_movements (product_id, outlet_id, movement_type, quantity, reference_id, created_by, notes)
          VALUES (v_order_item.product_id, v_main_warehouse_id, 'sale', -v_order_item.quantity, v_order.id, p_user_id, 
                  'Rapid dispatch: ' || v_order.order_number);
        END IF;
      END IF;
    END LOOP;
  END IF;

  -- ============ DEDUCT ALL PACKAGING ============
  SELECT deduct_order_packaging(v_order.id, p_user_id) INTO v_packaging_result;
  
  IF v_packaging_result->'warnings' IS NOT NULL AND jsonb_array_length(v_packaging_result->'warnings') > 0 THEN
    v_packaging_warning := (v_packaging_result->'warnings'->>0);
  END IF;

  -- Create dispatch record
  INSERT INTO dispatches (
    order_id,
    courier,
    courier_id,
    dispatched_by,
    dispatch_date,
    tracking_id
  ) VALUES (
    v_order.id,
    v_final_courier_name,
    p_courier_id,
    p_user_id,
    NOW(),
    v_order.tracking_id
  )
  RETURNING id INTO v_dispatch_id;

  -- Update order status to dispatched
  UPDATE orders
  SET 
    status = 'dispatched',
    dispatched_at = NOW(),
    updated_at = NOW()
  WHERE id = v_order.id;

  -- Return success with packaging info
  RETURN jsonb_build_object(
    'success', true,
    'order', jsonb_build_object(
      'id', v_order.id,
      'order_number', v_order.order_number,
      'customer_name', v_order.customer_name,
      'total_amount', v_order.total_amount,
      'status', 'dispatched',
      'courier', v_final_courier_name
    ),
    'dispatch', jsonb_build_object(
      'id', v_dispatch_id,
      'courier', v_final_courier_name,
      'courier_code', v_final_courier_code
    ),
    'packaging', v_packaging_result,
    'matchType', v_match_type,
    'warning', v_packaging_warning
  );
END;
$$;