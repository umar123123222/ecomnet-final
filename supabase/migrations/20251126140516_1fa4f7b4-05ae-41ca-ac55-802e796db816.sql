-- Step 1: Clean up duplicate dispatches (keep the most recent one per order)
DELETE FROM dispatches
WHERE id IN (
  SELECT d1.id
  FROM dispatches d1
  INNER JOIN dispatches d2 ON d1.order_id = d2.order_id
  WHERE d1.created_at < d2.created_at
);

-- Step 2: Create unique index to prevent future duplicates
CREATE UNIQUE INDEX IF NOT EXISTS idx_dispatches_order_id_unique ON dispatches(order_id);

-- Step 3: Create atomic dispatch function for ultra-fast processing
CREATE OR REPLACE FUNCTION rapid_dispatch_order(
  p_entry TEXT,
  p_user_id UUID,
  p_courier_id UUID DEFAULT NULL,
  p_courier_name TEXT DEFAULT NULL,
  p_courier_code TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order RECORD;
  v_dispatch_id UUID;
  v_final_courier_name TEXT;
  v_final_courier_code TEXT;
  v_match_type TEXT;
BEGIN
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

  -- Determine courier
  v_final_courier_name := COALESCE(p_courier_name, v_order.courier, 'Unknown');
  v_final_courier_code := COALESCE(p_courier_code, v_order.courier, 'unknown');

  -- Determine match type
  IF v_order.tracking_id = p_entry THEN
    v_match_type := 'tracking_id';
  ELSE
    v_match_type := 'order_number';
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

  -- Return success
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
    'matchType', v_match_type
  );
END;
$$;