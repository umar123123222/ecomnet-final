-- Drop and recreate functions with correct return type for status (order_status enum, not text)

-- Fix get_stuck_orders_at_our_end function
DROP FUNCTION IF EXISTS get_stuck_orders_at_our_end(TEXT, INTEGER, INTEGER);

CREATE OR REPLACE FUNCTION get_stuck_orders_at_our_end(
  search_query TEXT DEFAULT '',
  page_offset INTEGER DEFAULT 0,
  page_limit INTEGER DEFAULT 50
)
RETURNS TABLE (
  id UUID,
  order_number TEXT,
  customer_name TEXT,
  customer_phone TEXT,
  city TEXT,
  status order_status,
  courier courier_type,
  tracking_id TEXT,
  updated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ,
  total_amount NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    o.id,
    o.order_number,
    o.customer_name,
    o.customer_phone,
    o.city,
    o.status,
    o.courier,
    o.tracking_id,
    o.updated_at,
    o.created_at,
    o.total_amount
  FROM orders o
  WHERE (
    (o.status = 'pending' AND o.created_at < NOW() - INTERVAL '2 days')
    OR
    (o.status = 'booked' AND COALESCE(o.booked_at, o.created_at) < NOW() - INTERVAL '2 days')
  )
  AND (
    search_query = '' 
    OR o.order_number ILIKE '%' || search_query || '%'
    OR o.customer_name ILIKE '%' || search_query || '%'
    OR o.customer_phone ILIKE '%' || search_query || '%'
    OR o.city ILIKE '%' || search_query || '%'
  )
  ORDER BY o.created_at ASC
  LIMIT page_limit
  OFFSET page_offset;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public';

-- Fix get_stuck_orders_at_courier_end function
DROP FUNCTION IF EXISTS get_stuck_orders_at_courier_end(TEXT, INTEGER, INTEGER);

CREATE OR REPLACE FUNCTION get_stuck_orders_at_courier_end(
  search_query TEXT DEFAULT '',
  page_offset INTEGER DEFAULT 0,
  page_limit INTEGER DEFAULT 50
)
RETURNS TABLE (
  id UUID,
  order_number TEXT,
  customer_name TEXT,
  customer_phone TEXT,
  city TEXT,
  status order_status,
  courier courier_type,
  tracking_id TEXT,
  updated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ,
  total_amount NUMERIC,
  last_tracking_check TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    o.id,
    o.order_number,
    o.customer_name,
    o.customer_phone,
    o.city,
    o.status,
    o.courier,
    o.tracking_id,
    o.updated_at,
    o.created_at,
    o.total_amount,
    (SELECT MAX(cth.checked_at) FROM courier_tracking_history cth WHERE cth.order_id = o.id) as last_tracking_check
  FROM orders o
  WHERE o.status = 'dispatched'
  AND (
    NOT EXISTS (
      SELECT 1 FROM courier_tracking_history cth 
      WHERE cth.order_id = o.id
    )
    OR
    (
      SELECT MAX(cth.checked_at) FROM courier_tracking_history cth 
      WHERE cth.order_id = o.id
    ) < NOW() - INTERVAL '2 days'
  )
  AND (
    search_query = '' 
    OR o.order_number ILIKE '%' || search_query || '%'
    OR o.customer_name ILIKE '%' || search_query || '%'
    OR o.customer_phone ILIKE '%' || search_query || '%'
    OR o.city ILIKE '%' || search_query || '%'
  )
  ORDER BY o.created_at ASC
  LIMIT page_limit
  OFFSET page_offset;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public';