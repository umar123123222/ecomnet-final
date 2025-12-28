-- Function to count stuck orders at our end (pending/booked for 2+ days)
CREATE OR REPLACE FUNCTION get_stuck_at_our_end_count()
RETURNS INTEGER AS $$
DECLARE
  stuck_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO stuck_count
  FROM orders o
  WHERE (
    -- Pending orders where created_at is 2+ days old
    (o.status = 'pending' AND o.created_at < NOW() - INTERVAL '2 days')
    OR
    -- Booked orders where booked_at (or created_at if null) is 2+ days old
    (o.status = 'booked' AND COALESCE(o.booked_at, o.created_at) < NOW() - INTERVAL '2 days')
  );
  
  RETURN stuck_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to count stuck dispatched orders (no tracking update for 2+ days)
CREATE OR REPLACE FUNCTION get_stuck_at_courier_count()
RETURNS INTEGER AS $$
DECLARE
  stuck_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO stuck_count
  FROM orders o
  WHERE o.status = 'dispatched'
  AND (
    -- No tracking history at all
    NOT EXISTS (
      SELECT 1 FROM courier_tracking_history cth 
      WHERE cth.order_id = o.id
    )
    OR
    -- Last tracking update is more than 2 days old
    (
      SELECT MAX(checked_at) FROM courier_tracking_history cth 
      WHERE cth.order_id = o.id
    ) < NOW() - INTERVAL '2 days'
  );
  
  RETURN stuck_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get stuck orders at our end (for listing)
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
  status TEXT,
  courier TEXT,
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get stuck orders at courier end (for listing)
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
  status TEXT,
  courier TEXT,
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
$$ LANGUAGE plpgsql SECURITY DEFINER;