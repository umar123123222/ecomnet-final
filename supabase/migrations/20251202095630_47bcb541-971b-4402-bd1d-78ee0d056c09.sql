-- Create order_packaging_rules table
CREATE TABLE IF NOT EXISTS order_packaging_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  packaging_item_id UUID NOT NULL REFERENCES packaging_items(id) ON DELETE CASCADE,
  min_items INTEGER NOT NULL CHECK (min_items >= 0),
  max_items INTEGER NOT NULL CHECK (max_items >= min_items),
  priority INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT unique_packaging_rule UNIQUE (packaging_item_id, min_items, max_items)
);

-- Create order_packaging table
CREATE TABLE IF NOT EXISTS order_packaging (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  packaging_item_id UUID NOT NULL REFERENCES packaging_items(id),
  quantity INTEGER DEFAULT 1 CHECK (quantity > 0),
  auto_selected BOOLEAN DEFAULT true,
  selected_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Create packaging_movements table
CREATE TABLE IF NOT EXISTS packaging_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  packaging_item_id UUID NOT NULL REFERENCES packaging_items(id) ON DELETE CASCADE,
  movement_type TEXT NOT NULL CHECK (movement_type IN ('dispatch', 'adjustment', 'purchase', 'return')),
  quantity INTEGER NOT NULL,
  reference_id UUID,
  notes TEXT,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_order_packaging_rules_active ON order_packaging_rules(is_active, packaging_item_id);
CREATE INDEX IF NOT EXISTS idx_order_packaging_order ON order_packaging(order_id);
CREATE INDEX IF NOT EXISTS idx_packaging_movements_item ON packaging_movements(packaging_item_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_packaging_movements_reference ON packaging_movements(reference_id);

-- Enable RLS
ALTER TABLE order_packaging_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_packaging ENABLE ROW LEVEL SECURITY;
ALTER TABLE packaging_movements ENABLE ROW LEVEL SECURITY;

-- RLS Policies for order_packaging_rules
CREATE POLICY "Users can view active packaging rules"
  ON order_packaging_rules FOR SELECT
  USING (is_active = true);

CREATE POLICY "Admins can manage packaging rules"
  ON order_packaging_rules FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
      AND role IN ('super_admin', 'super_manager')
      AND is_active = true
    )
  );

-- RLS Policies for order_packaging
CREATE POLICY "Users can view order packaging"
  ON order_packaging FOR SELECT
  USING (true);

CREATE POLICY "System can insert order packaging"
  ON order_packaging FOR INSERT
  WITH CHECK (true);

-- RLS Policies for packaging_movements
CREATE POLICY "Users can view packaging movements"
  ON packaging_movements FOR SELECT
  USING (true);

CREATE POLICY "System can insert packaging movements"
  ON packaging_movements FOR INSERT
  WITH CHECK (true);

-- Function to get packaging recommendation for an order
CREATE OR REPLACE FUNCTION get_order_packaging_recommendation(p_order_id UUID)
RETURNS TABLE (
  packaging_item_id UUID,
  packaging_name TEXT,
  packaging_sku TEXT,
  quantity_needed INTEGER,
  current_stock INTEGER,
  is_available BOOLEAN
) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total_items INTEGER;
BEGIN
  -- Calculate total items in order
  SELECT COALESCE(SUM(quantity), 0) INTO v_total_items
  FROM order_items WHERE order_id = p_order_id;

  -- Find matching packaging rule
  RETURN QUERY
  SELECT 
    r.packaging_item_id,
    p.name,
    p.sku,
    1 AS quantity_needed,
    p.current_stock,
    (p.current_stock > 0) AS is_available
  FROM order_packaging_rules r
  JOIN packaging_items p ON p.id = r.packaging_item_id
  WHERE r.is_active = true
    AND p.is_active = true
    AND v_total_items BETWEEN r.min_items AND r.max_items
  ORDER BY r.priority DESC, r.min_items ASC
  LIMIT 1;
END;
$$;

-- Update rapid_dispatch_order to include packaging logic
CREATE OR REPLACE FUNCTION rapid_dispatch_order(
  p_entry text,
  p_user_id uuid,
  p_courier_id uuid DEFAULT NULL,
  p_courier_name text DEFAULT NULL,
  p_courier_code text DEFAULT NULL
)
RETURNS jsonb
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
  v_packaging RECORD;
  v_packaging_warning TEXT := NULL;
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

  -- Get packaging recommendation
  SELECT * INTO v_packaging
  FROM get_order_packaging_recommendation(v_order.id);

  -- Handle packaging
  IF v_packaging.packaging_item_id IS NOT NULL THEN
    IF v_packaging.is_available THEN
      -- Deduct packaging stock
      UPDATE packaging_items
      SET current_stock = current_stock - 1
      WHERE id = v_packaging.packaging_item_id;

      -- Record packaging usage
      INSERT INTO order_packaging (order_id, packaging_item_id, quantity, auto_selected, selected_by)
      VALUES (v_order.id, v_packaging.packaging_item_id, 1, true, p_user_id);

      -- Create packaging movement
      INSERT INTO packaging_movements (packaging_item_id, movement_type, quantity, reference_id, created_by, notes)
      VALUES (v_packaging.packaging_item_id, 'dispatch', -1, v_order.id, p_user_id, 'Auto-selected for dispatch');
    ELSE
      v_packaging_warning := 'Low stock: ' || v_packaging.packaging_name;
    END IF;
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
    'packaging', CASE 
      WHEN v_packaging.packaging_item_id IS NOT NULL THEN
        jsonb_build_object(
          'name', v_packaging.packaging_name,
          'sku', v_packaging.packaging_sku,
          'used', v_packaging.is_available,
          'warning', v_packaging_warning
        )
      ELSE NULL
    END,
    'matchType', v_match_type
  );
END;
$$;

COMMENT ON TABLE order_packaging_rules IS 'Rules for automatic packaging selection based on order item quantity';
COMMENT ON TABLE order_packaging IS 'Records which packaging was used for each dispatched order';
COMMENT ON TABLE packaging_movements IS 'Tracks stock movements for packaging items';
COMMENT ON FUNCTION get_order_packaging_recommendation IS 'Returns recommended packaging item for an order based on total item quantity';