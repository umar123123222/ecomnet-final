-- Force re-apply negative inventory support functions
-- This ensures all trigger functions correctly allow negative inventory

-- 1. Drop and recreate validate_inventory_quantities to allow negative quantity
CREATE OR REPLACE FUNCTION public.validate_inventory_quantities()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Only validate reserved_quantity is not negative
  -- Allow quantity to go negative (shows stock deficit)
  IF NEW.reserved_quantity < 0 THEN
    NEW.reserved_quantity := 0;
  END IF;
  
  RETURN NEW;
END;
$function$;

-- 2. Drop and recreate check_inventory_consistency to allow negative quantity
CREATE OR REPLACE FUNCTION public.check_inventory_consistency()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Allow negative quantity (shows stock deficit from overselling)
  -- Only ensure reserved_quantity is not negative
  IF NEW.reserved_quantity < 0 THEN
    NEW.reserved_quantity := 0;
  END IF;
  
  -- Ensure available_quantity is calculated correctly
  NEW.available_quantity := NEW.quantity - NEW.reserved_quantity;
  
  RETURN NEW;
END;
$function$;

-- 3. Update rapid_dispatch_order to not clamp quantity to 0
CREATE OR REPLACE FUNCTION public.rapid_dispatch_order(
  p_entry TEXT,
  p_courier_id UUID,
  p_courier_name TEXT,
  p_courier_code TEXT,
  p_user_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_order RECORD;
  v_dispatch RECORD;
  v_order_item RECORD;
  v_main_warehouse_id UUID;
  v_match_type TEXT;
  v_tracking_id TEXT;
  v_cleaned_entry TEXT;
BEGIN
  -- Clean the entry (remove spaces, handle common barcode issues)
  v_cleaned_entry := TRIM(p_entry);
  
  -- Try to find order by different match types
  -- 1. Try exact order_number match
  SELECT * INTO v_order FROM orders 
  WHERE order_number = v_cleaned_entry
  LIMIT 1;
  
  IF FOUND THEN
    v_match_type := 'order_number';
  ELSE
    -- 2. Try tracking_id match
    SELECT * INTO v_order FROM orders 
    WHERE tracking_id = v_cleaned_entry
    LIMIT 1;
    
    IF FOUND THEN
      v_match_type := 'tracking_id';
    ELSE
      -- 3. Try partial order number match (e.g., just the numeric part)
      SELECT * INTO v_order FROM orders 
      WHERE order_number LIKE '%' || v_cleaned_entry || '%'
         OR order_number LIKE '%' || REPLACE(v_cleaned_entry, 'SHOP-', '') || '%'
      LIMIT 1;
      
      IF FOUND THEN
        v_match_type := 'partial_order_number';
      ELSE
        -- 4. Try phone number match (last 5 digits)
        SELECT * INTO v_order FROM orders 
        WHERE RIGHT(REGEXP_REPLACE(customer_phone, '[^0-9]', '', 'g'), 5) = RIGHT(REGEXP_REPLACE(v_cleaned_entry, '[^0-9]', '', 'g'), 5)
          AND status IN ('pending', 'confirmed', 'booked')
        ORDER BY created_at DESC
        LIMIT 1;
        
        IF FOUND THEN
          v_match_type := 'phone_last_5';
        END IF;
      END IF;
    END IF;
  END IF;
  
  -- If no order found, return error
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Order not found',
      'error_code', 'ORDER_NOT_FOUND',
      'entry', v_cleaned_entry
    );
  END IF;
  
  -- Check if order is already dispatched
  IF v_order.status = 'dispatched' THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Order already dispatched',
      'error_code', 'ALREADY_DISPATCHED',
      'order_number', v_order.order_number,
      'order_id', v_order.id
    );
  END IF;
  
  -- Check if order is in a terminal state
  IF v_order.status IN ('delivered', 'cancelled', 'returned') THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Order is in terminal state: ' || v_order.status,
      'error_code', 'TERMINAL_STATE',
      'order_number', v_order.order_number,
      'status', v_order.status
    );
  END IF;
  
  -- Get tracking ID (use existing or from order)
  v_tracking_id := COALESCE(v_order.tracking_id, '');
  
  -- Get main warehouse ID
  SELECT id INTO v_main_warehouse_id 
  FROM outlets 
  WHERE outlet_type = 'warehouse' 
  ORDER BY created_at ASC
  LIMIT 1;
  
  -- Deduct inventory for each order item (allow negative quantities)
  FOR v_order_item IN 
    SELECT oi.*, p.is_bundle
    FROM order_items oi
    LEFT JOIN products p ON p.id = oi.product_id
    WHERE oi.order_id = v_order.id
  LOOP
    IF v_order_item.product_id IS NOT NULL THEN
      -- Check if it's a bundle
      IF v_order_item.is_bundle = true THEN
        -- Deduct component products for bundles
        UPDATE inventory i
        SET 
          quantity = quantity - (pbi.component_quantity * v_order_item.quantity),
          reserved_quantity = GREATEST(0, reserved_quantity - (pbi.component_quantity * v_order_item.quantity))
        FROM product_bundle_items pbi
        WHERE pbi.bundle_product_id = v_order_item.product_id
          AND i.product_id = pbi.component_product_id
          AND i.outlet_id = v_main_warehouse_id;
      ELSE
        -- Deduct regular product - ALLOW NEGATIVE QUANTITY
        UPDATE inventory
        SET 
          quantity = quantity - v_order_item.quantity,
          reserved_quantity = GREATEST(0, reserved_quantity - v_order_item.quantity)
        WHERE product_id = v_order_item.product_id
          AND outlet_id = v_main_warehouse_id;
      END IF;
      
      -- Create stock movement record
      INSERT INTO stock_movements (
        product_id, outlet_id, movement_type, quantity, 
        reference_id, reference_type, created_by, notes
      ) VALUES (
        v_order_item.product_id, v_main_warehouse_id, 'dispatch', 
        -v_order_item.quantity, v_order.id, 'order', p_user_id,
        'Rapid dispatch: ' || v_order.order_number
      );
    END IF;
  END LOOP;
  
  -- Deduct packaging
  PERFORM deduct_order_packaging(v_order.id, p_user_id);
  
  -- Update order status to dispatched
  UPDATE orders
  SET 
    status = 'dispatched',
    dispatched_at = NOW(),
    courier = p_courier_code::courier_type,
    updated_at = NOW()
  WHERE id = v_order.id;
  
  -- Create or update dispatch record
  INSERT INTO dispatches (
    order_id, courier, courier_id, tracking_id, 
    dispatch_date, dispatched_by, notes
  ) VALUES (
    v_order.id, p_courier_name, p_courier_id, v_tracking_id,
    NOW(), p_user_id, 'Rapid dispatch'
  )
  ON CONFLICT (order_id) DO UPDATE SET
    courier = EXCLUDED.courier,
    courier_id = EXCLUDED.courier_id,
    dispatch_date = EXCLUDED.dispatch_date,
    dispatched_by = EXCLUDED.dispatched_by,
    updated_at = NOW();
  
  -- Return success
  RETURN jsonb_build_object(
    'success', true,
    'order_id', v_order.id,
    'order_number', v_order.order_number,
    'customer_name', v_order.customer_name,
    'total_amount', v_order.total_amount,
    'courier', p_courier_name,
    'tracking_id', v_tracking_id,
    'match_type', v_match_type
  );
END;
$function$;