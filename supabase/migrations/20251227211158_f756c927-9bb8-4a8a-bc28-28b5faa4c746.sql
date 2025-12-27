
-- =====================================================
-- FIX DUPLICATE STOCK MOVEMENTS - PART 1
-- =====================================================

-- STEP 1: Clean up existing duplicate stock movements
-- Keep the oldest record, delete duplicates
WITH duplicates AS (
  SELECT id, 
         ROW_NUMBER() OVER (
           PARTITION BY reference_id, product_id, movement_type 
           ORDER BY created_at ASC
         ) as rn
  FROM stock_movements
  WHERE movement_type = 'sale'
    AND reference_id IS NOT NULL
)
DELETE FROM stock_movements
WHERE id IN (SELECT id FROM duplicates WHERE rn > 1);

-- STEP 2: Add unique constraint to prevent future duplicates
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes 
    WHERE indexname = 'idx_stock_movements_unique_sale'
  ) THEN
    CREATE UNIQUE INDEX idx_stock_movements_unique_sale 
    ON stock_movements (reference_id, product_id, movement_type) 
    WHERE movement_type = 'sale' AND reference_id IS NOT NULL;
  END IF;
END $$;

-- STEP 3: Update rapid_dispatch_order function with row-level locking
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
  -- Get main warehouse ID first
  SELECT id INTO v_main_warehouse_id 
  FROM outlets 
  WHERE outlet_type = 'warehouse' 
  ORDER BY created_at ASC
  LIMIT 1;

  -- CRITICAL: Use FOR UPDATE to lock the row and prevent race conditions
  -- Try to find order by exact order_number match with row lock
  SELECT * INTO v_order
  FROM orders
  WHERE order_number = p_entry
    AND status IN ('booked', 'confirmed')
  FOR UPDATE SKIP LOCKED
  LIMIT 1;
  
  IF FOUND THEN
    v_match_type := 'order_number';
  ELSE
    -- Try tracking_id match with row lock
    SELECT * INTO v_order
    FROM orders
    WHERE tracking_id = p_entry
      AND status IN ('booked', 'confirmed')
    FOR UPDATE SKIP LOCKED
    LIMIT 1;
    
    IF FOUND THEN
      v_match_type := 'tracking_id';
    ELSE
      -- Try order_number suffix match with row lock
      SELECT * INTO v_order
      FROM orders
      WHERE order_number LIKE '%' || p_entry
        AND status IN ('booked', 'confirmed')
      FOR UPDATE SKIP LOCKED
      LIMIT 1;
      
      IF FOUND THEN
        v_match_type := 'order_number_suffix';
      ELSE
        -- Try dispatch tracking_id with row lock
        SELECT o.* INTO v_order
        FROM orders o
        JOIN dispatches d ON d.order_id = o.id
        WHERE d.tracking_id = p_entry
          AND o.status IN ('booked', 'confirmed')
        FOR UPDATE OF o SKIP LOCKED
        LIMIT 1;
        
        IF FOUND THEN
          v_match_type := 'dispatch_tracking';
        END IF;
      END IF;
    END IF;
  END IF;
  
  -- If no order found or was locked by another process
  IF NOT FOUND THEN
    -- Check if order exists but is already dispatched
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
    
    -- Check if order is being processed by another request (SKIP LOCKED)
    SELECT * INTO v_order
    FROM orders
    WHERE (order_number = p_entry OR tracking_id = p_entry OR order_number LIKE '%' || p_entry)
      AND status IN ('booked', 'confirmed')
    LIMIT 1;
    
    IF FOUND THEN
      -- Order exists but was locked - being processed
      RETURN jsonb_build_object(
        'success', false,
        'error', 'Order is being processed',
        'errorCode', 'PROCESSING',
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
  
  -- Double check status (order is now locked)
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
  -- Using ON CONFLICT to prevent duplicates
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
    ON CONFLICT (reference_id, product_id, movement_type) 
    WHERE movement_type = 'sale' AND reference_id IS NOT NULL
    DO NOTHING
    RETURNING 1
  )
  SELECT COUNT(*) INTO v_movements_created FROM inserted;

  -- Handle customer choice bundles
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
      AND NOT EXISTS (
        SELECT 1 FROM order_items oi2
        WHERE oi2.order_id = v_order.id
          AND oi2.bundle_product_id = oi.product_id
          AND oi2.is_bundle_component = true
      )
    ON CONFLICT (reference_id, product_id, movement_type) 
    WHERE movement_type = 'sale' AND reference_id IS NOT NULL
    DO NOTHING
    RETURNING 1
  )
  SELECT COUNT(*) INTO v_bundle_movements_created FROM bundle_movements;

  -- Deduct packaging
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
  
  -- Handle dispatch record
  SELECT * INTO v_dispatch
  FROM dispatches
  WHERE order_id = v_order.id
  LIMIT 1;
  
  IF FOUND THEN
    UPDATE dispatches
    SET 
      dispatch_date = NOW(),
      dispatched_by = p_user_id,
      courier = COALESCE(p_courier_name, p_courier_code, courier),
      courier_id = COALESCE(p_courier_id, courier_id),
      updated_at = NOW()
    WHERE id = v_dispatch.id;
  ELSE
    INSERT INTO dispatches (order_id, courier, courier_id, tracking_id, dispatch_date, dispatched_by, created_at, updated_at)
    VALUES (v_order.id, COALESCE(p_courier_name, p_courier_code, v_order.courier::text), p_courier_id, v_order.tracking_id, NOW(), p_user_id, NOW(), NOW());
  END IF;
  
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
