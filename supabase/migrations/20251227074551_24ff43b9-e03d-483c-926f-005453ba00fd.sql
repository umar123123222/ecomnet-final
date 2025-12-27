-- Step 1: Create missing stock movement for order #342268
DO $$
DECLARE
  v_order_id UUID;
  v_main_warehouse_id UUID;
  v_user_id UUID;
BEGIN
  -- Get the order ID
  SELECT id INTO v_order_id FROM orders WHERE order_number = '#342268' OR order_number = '342268' LIMIT 1;
  
  -- Get main warehouse
  SELECT id INTO v_main_warehouse_id FROM outlets WHERE outlet_type = 'warehouse' ORDER BY created_at ASC LIMIT 1;
  
  -- Get a system user for the created_by field
  SELECT id INTO v_user_id FROM profiles LIMIT 1;
  
  IF v_order_id IS NOT NULL AND v_main_warehouse_id IS NOT NULL THEN
    -- Create stock movements for order items that don't have movements yet
    INSERT INTO stock_movements (product_id, outlet_id, quantity, movement_type, reference_id, notes, created_by)
    SELECT 
      oi.product_id,
      v_main_warehouse_id,
      -oi.quantity,
      'sale',
      v_order_id,
      'Backfill: Order #342268 - customer choice bundle fix',
      v_user_id
    FROM order_items oi
    WHERE oi.order_id = v_order_id
      AND oi.product_id IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM stock_movements sm 
        WHERE sm.reference_id = v_order_id 
          AND sm.product_id = oi.product_id
          AND sm.movement_type = 'sale'
      );
    
    RAISE NOTICE 'Created stock movements for order #342268';
  ELSE
    RAISE NOTICE 'Order #342268 or warehouse not found';
  END IF;
END $$;

-- Step 2: Update rapid_dispatch_order to handle customer choice bundles
-- Add fallback stock movement when no product movements are created
CREATE OR REPLACE FUNCTION public.rapid_dispatch_order(p_entry text, p_user_id uuid, p_courier_id uuid DEFAULT NULL::uuid, p_courier_name text DEFAULT NULL::text, p_courier_code text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_order RECORD;
  v_dispatch RECORD;
  v_main_warehouse_id UUID;
  v_result JSONB;
  v_match_type TEXT;
  v_packaging_result JSONB;
  v_movements_created INTEGER := 0;
  v_bundle_movements_created INTEGER := 0;
BEGIN
  -- Check if order was already processed (idempotency check)
  -- This prevents double-processing from rapid sequential scans
  SELECT * INTO v_order
  FROM orders
  WHERE (order_number = p_entry OR tracking_id = p_entry OR order_number LIKE '%' || p_entry)
    AND status = 'dispatched'
    AND dispatched_at > NOW() - INTERVAL '5 minutes'
  LIMIT 1;
  
  IF FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Already Dispatched (within last 5 min)',
      'errorCode', 'ALREADY_DISPATCHED',
      'order_id', v_order.id,
      'order_number', v_order.order_number
    );
  END IF;

  -- Get main warehouse ID
  SELECT id INTO v_main_warehouse_id 
  FROM outlets 
  WHERE outlet_type = 'warehouse' 
  ORDER BY created_at ASC
  LIMIT 1;

  -- Try to find order by multiple methods
  -- 1. Try exact order_number match
  SELECT * INTO v_order
  FROM orders
  WHERE order_number = p_entry
    AND status IN ('booked', 'confirmed')
  LIMIT 1;
  
  IF FOUND THEN
    v_match_type := 'order_number';
  ELSE
    -- 2. Try tracking_id match
    SELECT * INTO v_order
    FROM orders
    WHERE tracking_id = p_entry
      AND status IN ('booked', 'confirmed')
    LIMIT 1;
    
    IF FOUND THEN
      v_match_type := 'tracking_id';
    ELSE
      -- 3. Try order_number without prefix (e.g., "321274" matches "SHOP-321274")
      SELECT * INTO v_order
      FROM orders
      WHERE order_number LIKE '%' || p_entry
        AND status IN ('booked', 'confirmed')
      LIMIT 1;
      
      IF FOUND THEN
        v_match_type := 'order_number_suffix';
      ELSE
        -- 4. Try dispatch tracking_id
        SELECT o.* INTO v_order
        FROM orders o
        JOIN dispatches d ON d.order_id = o.id
        WHERE d.tracking_id = p_entry
          AND o.status IN ('booked', 'confirmed')
        LIMIT 1;
        
        IF FOUND THEN
          v_match_type := 'dispatch_tracking';
        END IF;
      END IF;
    END IF;
  END IF;
  
  -- If no order found, check if order exists but is already dispatched
  IF NOT FOUND THEN
    -- Check if order exists but already dispatched
    SELECT * INTO v_order
    FROM orders
    WHERE (order_number = p_entry OR tracking_id = p_entry OR order_number LIKE '%' || p_entry)
      AND status = 'dispatched'
    LIMIT 1;
    
    IF FOUND THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', 'Already Dispatched',
        'errorCode', 'ALREADY_DISPATCHED',
        'order_id', v_order.id,
        'order_number', v_order.order_number
      );
    END IF;
    
    -- Order truly not found
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Order Not Found',
      'errorCode', 'ORDER_NOT_FOUND',
      'scanned_entry', p_entry
    );
  END IF;
  
  -- Check if already dispatched (double check for found orders)
  IF v_order.status = 'dispatched' THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Already Dispatched',
      'errorCode', 'ALREADY_DISPATCHED',
      'order_id', v_order.id,
      'order_number', v_order.order_number
    );
  END IF;

  -- Deduct product inventory from main warehouse (EXCLUDING bundle products)
  UPDATE inventory i
  SET 
    quantity = i.quantity - oi.quantity,
    reserved_quantity = GREATEST(0, i.reserved_quantity - oi.quantity),
    updated_at = NOW()
  FROM order_items oi
  JOIN products p ON p.id = oi.product_id
  WHERE oi.order_id = v_order.id
    AND i.product_id = oi.product_id
    AND i.outlet_id = v_main_warehouse_id
    AND (p.is_bundle = false OR p.is_bundle IS NULL);

  -- Create stock movements for products (EXCLUDING bundle products)
  WITH inserted AS (
    INSERT INTO stock_movements (product_id, outlet_id, quantity, movement_type, reference_id, notes, created_by)
    SELECT 
      oi.product_id,
      v_main_warehouse_id,
      -oi.quantity,
      'sale',
      v_order.id,
      'Rapid dispatch: Order ' || v_order.order_number,
      p_user_id
    FROM order_items oi
    JOIN products p ON p.id = oi.product_id
    WHERE oi.order_id = v_order.id
      AND oi.product_id IS NOT NULL
      AND (p.is_bundle = false OR p.is_bundle IS NULL)
    RETURNING 1
  )
  SELECT COUNT(*) INTO v_movements_created FROM inserted;

  -- NEW: Handle customer choice bundles - create tracking movements for bundle products
  -- This ensures bundles are counted in dispatch summaries even if components aren't tracked
  WITH bundle_movements AS (
    INSERT INTO stock_movements (product_id, outlet_id, quantity, movement_type, reference_id, notes, created_by)
    SELECT 
      oi.product_id,
      v_main_warehouse_id,
      -oi.quantity,
      'sale',
      v_order.id,
      'Rapid dispatch (bundle): Order ' || v_order.order_number || ' - ' || COALESCE(oi.bundle_name, p.name),
      p_user_id
    FROM order_items oi
    JOIN products p ON p.id = oi.product_id
    WHERE oi.order_id = v_order.id
      AND oi.product_id IS NOT NULL
      AND p.is_bundle = true
      -- Only create if no component movements exist for this bundle
      AND NOT EXISTS (
        SELECT 1 FROM order_items oi2
        WHERE oi2.order_id = v_order.id
          AND oi2.bundle_product_id = oi.product_id
          AND oi2.is_bundle_component = true
      )
    RETURNING 1
  )
  SELECT COUNT(*) INTO v_bundle_movements_created FROM bundle_movements;

  -- Deduct packaging using the unified function
  SELECT deduct_order_packaging(v_order.id, p_user_id) INTO v_packaging_result;

  -- Update order status to dispatched
  UPDATE orders
  SET 
    status = 'dispatched',
    dispatched_at = NOW(),
    courier = CASE 
      WHEN p_courier_code IS NOT NULL AND p_courier_code IN ('postex', 'leopard', 'tcs', 'other') 
      THEN p_courier_code::courier_type 
      ELSE courier 
    END,
    updated_at = NOW()
  WHERE id = v_order.id;
  
  -- Check if dispatch record exists
  SELECT * INTO v_dispatch
  FROM dispatches
  WHERE order_id = v_order.id
  LIMIT 1;
  
  IF FOUND THEN
    -- Update existing dispatch
    UPDATE dispatches
    SET 
      dispatch_date = NOW(),
      dispatched_by = p_user_id,
      courier = COALESCE(p_courier_name, p_courier_code, courier),
      courier_id = COALESCE(p_courier_id, courier_id),
      updated_at = NOW()
    WHERE id = v_dispatch.id;
  ELSE
    -- Create new dispatch record
    INSERT INTO dispatches (
      order_id,
      courier,
      courier_id,
      tracking_id,
      dispatch_date,
      dispatched_by,
      created_at,
      updated_at
    ) VALUES (
      v_order.id,
      COALESCE(p_courier_name, p_courier_code, v_order.courier::text),
      p_courier_id,
      v_order.tracking_id,
      NOW(),
      p_user_id,
      NOW(),
      NOW()
    );
  END IF;
  
  -- Return success with order details
  RETURN jsonb_build_object(
    'success', true,
    'error', 'Dispatched Successfully',
    'order_id', v_order.id,
    'order_number', v_order.order_number,
    'customer_name', v_order.customer_name,
    'courier', COALESCE(p_courier_code, v_order.courier::text),
    'tracking_id', v_order.tracking_id,
    'match_type', v_match_type,
    'packaging', v_packaging_result,
    'stock_movements', v_movements_created,
    'bundle_movements', v_bundle_movements_created
  );
  
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM,
      'errorCode', 'DB_ERROR',
      'scanned_entry', p_entry
    );
END;
$function$;

-- Step 3: Fix bundle product flags for known customer choice bundles
UPDATE products
SET is_bundle = true
WHERE name ILIKE '%Mega Deal%' 
   OR name ILIKE '%Perfume Bundle%'
   OR name ILIKE '%x Perfume%';