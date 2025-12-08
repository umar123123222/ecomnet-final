
-- Function to get packaging reservations filtered by order date range
CREATE OR REPLACE FUNCTION public.get_packaging_reservations_by_date(
  p_start_date timestamptz DEFAULT NULL,
  p_end_date timestamptz DEFAULT NULL
)
RETURNS TABLE(packaging_item_id uuid, reserved_quantity bigint)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
  WITH order_totals AS (
    SELECT 
      o.id as order_id,
      COALESCE(SUM(oi.quantity), 0) as total_items
    FROM orders o
    JOIN order_items oi ON oi.order_id = o.id
    WHERE o.status IN ('pending', 'confirmed', 'booked')
      AND (p_start_date IS NULL OR o.created_at >= p_start_date)
      AND (p_end_date IS NULL OR o.created_at <= p_end_date)
    GROUP BY o.id
  ),
  per_order_reservations AS (
    SELECT 
      opr.packaging_item_id,
      COUNT(DISTINCT ot.order_id) as order_count
    FROM order_totals ot
    JOIN order_packaging_rules opr ON ot.total_items BETWEEN opr.min_items AND opr.max_items
    WHERE opr.is_active = true
    GROUP BY opr.packaging_item_id
  ),
  per_product_reservations AS (
    SELECT 
      pi.id as packaging_item_id,
      COALESCE(SUM(oi.quantity), 0) as reserved_qty
    FROM packaging_items pi
    JOIN order_items oi ON oi.product_id IS NOT NULL
    JOIN orders o ON o.id = oi.order_id
    WHERE pi.allocation_type = 'per_product'
      AND pi.is_active = true
      AND o.status IN ('pending', 'confirmed', 'booked')
      AND (p_start_date IS NULL OR o.created_at >= p_start_date)
      AND (p_end_date IS NULL OR o.created_at <= p_end_date)
      AND NOT EXISTS (
        SELECT 1 FROM packaging_items pi2
        WHERE pi2.allocation_type = 'product_specific'
          AND pi2.is_active = true
          AND oi.product_id = ANY(pi2.linked_product_ids)
      )
    GROUP BY pi.id
  ),
  product_specific_reservations AS (
    SELECT 
      pi.id as packaging_item_id,
      COALESCE(SUM(oi.quantity), 0) as reserved_qty
    FROM packaging_items pi
    JOIN order_items oi ON oi.product_id = ANY(pi.linked_product_ids)
    JOIN orders o ON o.id = oi.order_id
    WHERE pi.allocation_type = 'product_specific'
      AND pi.is_active = true
      AND o.status IN ('pending', 'confirmed', 'booked')
      AND (p_start_date IS NULL OR o.created_at >= p_start_date)
      AND (p_end_date IS NULL OR o.created_at <= p_end_date)
    GROUP BY pi.id
  )
  SELECT 
    COALESCE(por.packaging_item_id, COALESCE(ppr.packaging_item_id, psr.packaging_item_id)) as packaging_item_id,
    (COALESCE(por.order_count, 0) + COALESCE(ppr.reserved_qty, 0) + COALESCE(psr.reserved_qty, 0))::bigint as reserved_quantity
  FROM per_order_reservations por
  FULL OUTER JOIN per_product_reservations ppr ON por.packaging_item_id = ppr.packaging_item_id
  FULL OUTER JOIN product_specific_reservations psr ON COALESCE(por.packaging_item_id, ppr.packaging_item_id) = psr.packaging_item_id
  WHERE COALESCE(por.order_count, 0) + COALESCE(ppr.reserved_qty, 0) + COALESCE(psr.reserved_qty, 0) > 0;
END;
$$;

-- Function to calculate product reserved quantity filtered by order date range
CREATE OR REPLACE FUNCTION public.calculate_reserved_quantity_by_date(
  p_product_id uuid,
  p_outlet_id uuid,
  p_start_date timestamptz DEFAULT NULL,
  p_end_date timestamptz DEFAULT NULL
)
RETURNS integer
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_direct_reserved integer := 0;
  v_bundle_reserved integer := 0;
BEGIN
  -- Calculate direct order item reservations
  SELECT COALESCE(SUM(oi.quantity), 0)
  INTO v_direct_reserved
  FROM order_items oi
  JOIN orders o ON o.id = oi.order_id
  WHERE oi.product_id = p_product_id
    AND o.status IN ('pending', 'confirmed', 'booked')
    AND (p_start_date IS NULL OR o.created_at >= p_start_date)
    AND (p_end_date IS NULL OR o.created_at <= p_end_date);

  -- Calculate bundle component reservations
  SELECT COALESCE(SUM(oi.quantity * pbi.quantity), 0)
  INTO v_bundle_reserved
  FROM order_items oi
  JOIN orders o ON o.id = oi.order_id
  JOIN product_bundle_items pbi ON pbi.bundle_product_id = oi.product_id
  WHERE pbi.component_product_id = p_product_id
    AND o.status IN ('pending', 'confirmed', 'booked')
    AND (p_start_date IS NULL OR o.created_at >= p_start_date)
    AND (p_end_date IS NULL OR o.created_at <= p_end_date);

  RETURN v_direct_reserved + v_bundle_reserved;
END;
$$;

-- Batch function to get all product reservations for a date range (more efficient)
CREATE OR REPLACE FUNCTION public.get_all_product_reservations_by_date(
  p_start_date timestamptz DEFAULT NULL,
  p_end_date timestamptz DEFAULT NULL
)
RETURNS TABLE(product_id uuid, reserved_quantity bigint)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
  WITH direct_reservations AS (
    SELECT 
      oi.product_id,
      COALESCE(SUM(oi.quantity), 0) as reserved_qty
    FROM order_items oi
    JOIN orders o ON o.id = oi.order_id
    WHERE oi.product_id IS NOT NULL
      AND o.status IN ('pending', 'confirmed', 'booked')
      AND (p_start_date IS NULL OR o.created_at >= p_start_date)
      AND (p_end_date IS NULL OR o.created_at <= p_end_date)
    GROUP BY oi.product_id
  ),
  bundle_reservations AS (
    SELECT 
      pbi.component_product_id as product_id,
      COALESCE(SUM(oi.quantity * pbi.quantity), 0) as reserved_qty
    FROM order_items oi
    JOIN orders o ON o.id = oi.order_id
    JOIN product_bundle_items pbi ON pbi.bundle_product_id = oi.product_id
    WHERE o.status IN ('pending', 'confirmed', 'booked')
      AND (p_start_date IS NULL OR o.created_at >= p_start_date)
      AND (p_end_date IS NULL OR o.created_at <= p_end_date)
    GROUP BY pbi.component_product_id
  )
  SELECT 
    COALESCE(dr.product_id, br.product_id) as product_id,
    (COALESCE(dr.reserved_qty, 0) + COALESCE(br.reserved_qty, 0))::bigint as reserved_quantity
  FROM direct_reservations dr
  FULL OUTER JOIN bundle_reservations br ON dr.product_id = br.product_id;
END;
$$;
