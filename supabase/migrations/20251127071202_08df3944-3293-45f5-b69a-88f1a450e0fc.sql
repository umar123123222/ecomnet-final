-- Function to get order statistics grouped by status (all-time)
CREATE OR REPLACE FUNCTION get_order_stats_by_status()
RETURNS TABLE (
  status order_status,
  count BIGINT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    status,
    COUNT(*)::BIGINT as count
  FROM orders
  GROUP BY status;
$$;

-- Function to get order statistics grouped by status for a date range
CREATE OR REPLACE FUNCTION get_order_stats_by_status_range(
  start_date TIMESTAMPTZ,
  end_date TIMESTAMPTZ
)
RETURNS TABLE (
  status order_status,
  count BIGINT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    status,
    COUNT(*)::BIGINT as count
  FROM orders
  WHERE created_at >= start_date 
    AND created_at <= end_date
  GROUP BY status;
$$;