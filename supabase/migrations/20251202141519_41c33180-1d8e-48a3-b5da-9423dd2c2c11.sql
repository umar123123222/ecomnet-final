-- Enhanced function to calculate packaging reservations with three allocation types:
-- 1. Per-product packaging (corrugated box, shopping bag, gift box for each perfume)
-- 2. Product-specific packaging (tester box for tester products only)
-- 3. Per-order rules-based packaging (flyers via order_packaging_rules)

CREATE OR REPLACE FUNCTION public.get_packaging_reservations()
RETURNS TABLE(packaging_item_id uuid, reserved_count bigint)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  -- Per-product packaging item IDs
  v_corrugated_box_id uuid := 'f3291e35-4271-436c-81c7-2e3eb0cb4d9a';
  v_shopping_bag_id uuid := '12598db4-2b80-43c6-9a24-176712a8c463';
  v_gift_box_id uuid := '5c8035b5-eaf6-46f3-9014-db5bcd59da63';
  -- Tester box packaging and product IDs
  v_tester_box_packaging_id uuid := '3b059acf-9519-43df-bdf0-a4f6125db079';
  v_tester_box_product_id uuid := '3b2a0ff7-3a21-4fcd-a03f-d305afde5eed';
BEGIN
  RETURN QUERY
  WITH pending_orders AS (
    SELECT id FROM orders WHERE status IN ('pending', 'booked')
  ),
  -- Calculate per-product packaging (perfume products excluding tester)
  perfume_product_count AS (
    SELECT COALESCE(SUM(oi.quantity), 0)::bigint as total_perfume_qty
    FROM order_items oi
    JOIN pending_orders po ON po.id = oi.order_id
    WHERE oi.product_id IS NULL 
       OR oi.product_id != v_tester_box_product_id
  ),
  -- Calculate tester box product count
  tester_product_count AS (
    SELECT COALESCE(SUM(oi.quantity), 0)::bigint as total_tester_qty
    FROM order_items oi
    JOIN pending_orders po ON po.id = oi.order_id
    WHERE oi.product_id = v_tester_box_product_id
  ),
  -- Calculate per-order packaging (flyers via rules)
  order_item_counts AS (
    SELECT oi.order_id, SUM(oi.quantity)::int as total_items
    FROM order_items oi
    JOIN pending_orders po ON po.id = oi.order_id
    GROUP BY oi.order_id
  ),
  matched_flyers AS (
    SELECT DISTINCT ON (oic.order_id) 
      oic.order_id, 
      opr.packaging_item_id
    FROM order_item_counts oic
    JOIN order_packaging_rules opr ON 
      oic.total_items >= opr.min_items 
      AND oic.total_items <= opr.max_items
      AND opr.is_active = true
    ORDER BY oic.order_id, opr.priority DESC, opr.min_items ASC
  ),
  flyer_counts AS (
    SELECT mf.packaging_item_id as pkg_id, COUNT(*)::bigint as cnt
    FROM matched_flyers mf
    GROUP BY mf.packaging_item_id
  ),
  -- Combine all packaging reservations
  all_reservations AS (
    -- Per-product packaging (one per perfume product)
    SELECT v_corrugated_box_id as pkg_id, (SELECT total_perfume_qty FROM perfume_product_count) as cnt
    UNION ALL
    SELECT v_shopping_bag_id, (SELECT total_perfume_qty FROM perfume_product_count)
    UNION ALL
    SELECT v_gift_box_id, (SELECT total_perfume_qty FROM perfume_product_count)
    UNION ALL
    -- Product-specific packaging (tester box)
    SELECT v_tester_box_packaging_id, (SELECT total_tester_qty FROM tester_product_count)
    UNION ALL
    -- Per-order rules-based packaging (flyers)
    SELECT fc.pkg_id, fc.cnt FROM flyer_counts fc
  )
  SELECT ar.pkg_id as packaging_item_id, ar.cnt as reserved_count
  FROM all_reservations ar
  WHERE ar.cnt > 0;
END;
$$;