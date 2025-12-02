-- Calculate reserved packaging based on pending/booked orders matching packaging rules
CREATE OR REPLACE FUNCTION public.get_packaging_reservations()
RETURNS TABLE(packaging_item_id uuid, reserved_count bigint)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
  WITH order_item_counts AS (
    -- Get total items per order for pending/booked orders
    SELECT oi.order_id, SUM(oi.quantity)::int as total_items
    FROM order_items oi
    JOIN orders o ON o.id = oi.order_id
    WHERE o.status IN ('pending', 'booked')
    GROUP BY oi.order_id
  ),
  matched_packaging AS (
    -- Match each order to the best packaging rule based on priority
    SELECT DISTINCT ON (oic.order_id) 
      oic.order_id, 
      opr.packaging_item_id
    FROM order_item_counts oic
    JOIN order_packaging_rules opr ON 
      oic.total_items >= opr.min_items 
      AND oic.total_items <= opr.max_items
      AND opr.is_active = true
    ORDER BY oic.order_id, opr.priority DESC, opr.min_items ASC
  )
  -- Aggregate by packaging item
  SELECT mp.packaging_item_id, COUNT(*)::bigint as reserved_count
  FROM matched_packaging mp
  GROUP BY mp.packaging_item_id;
END;
$$;