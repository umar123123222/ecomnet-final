-- Phase 1: Database Cleanup and Optimization

-- 1. Clean up old sync_queue entries (keeping only recent data)
DELETE FROM sync_queue 
WHERE status = 'failed' AND created_at < NOW() - INTERVAL '7 days';

DELETE FROM sync_queue 
WHERE status = 'completed' AND created_at < NOW() - INTERVAL '1 day';

-- 2. Add indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_orders_status_created_at ON orders(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_tracking_id ON orders(tracking_id) WHERE tracking_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_sync_queue_status_created ON sync_queue(status, created_at);
CREATE INDEX IF NOT EXISTS idx_dispatches_order_id ON dispatches(order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_inventory_product_outlet ON inventory(product_id, outlet_id);

-- 3. Create aggregated dashboard stats function (reduces 21 queries to 1)
CREATE OR REPLACE FUNCTION get_dashboard_stats(
  p_start_date TIMESTAMPTZ DEFAULT NULL,
  p_end_date TIMESTAMPTZ DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  result JSON;
BEGIN
  SELECT json_build_object(
    'order_counts', (
      SELECT json_object_agg(status, cnt)
      FROM (
        SELECT status, COUNT(*)::INT as cnt
        FROM orders
        WHERE (p_start_date IS NULL OR created_at >= p_start_date)
          AND (p_end_date IS NULL OR created_at <= p_end_date)
        GROUP BY status
      ) s
    ),
    'total_orders', (
      SELECT COUNT(*)::INT FROM orders
      WHERE (p_start_date IS NULL OR created_at >= p_start_date)
        AND (p_end_date IS NULL OR created_at <= p_end_date)
    ),
    'total_revenue', (
      SELECT COALESCE(SUM(total), 0)::NUMERIC FROM orders
      WHERE status = 'delivered'
        AND (p_start_date IS NULL OR created_at >= p_start_date)
        AND (p_end_date IS NULL OR created_at <= p_end_date)
    ),
    'total_customers', (
      SELECT COUNT(DISTINCT customer_id)::INT FROM orders
      WHERE (p_start_date IS NULL OR created_at >= p_start_date)
        AND (p_end_date IS NULL OR created_at <= p_end_date)
    ),
    'pending_count', (
      SELECT COUNT(*)::INT FROM orders WHERE status = 'pending'
    ),
    'dispatched_today', (
      SELECT COUNT(*)::INT FROM orders 
      WHERE status = 'dispatched' 
        AND dispatched_at >= CURRENT_DATE
    )
  ) INTO result;
  
  RETURN result;
END;
$$;

-- 4. Create order counts by status function (optimized for order dashboard)
CREATE OR REPLACE FUNCTION get_order_counts_by_status_optimized()
RETURNS TABLE(status order_status, count BIGINT, today_count BIGINT)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT 
    o.status,
    COUNT(*)::BIGINT as count,
    COUNT(*) FILTER (WHERE o.created_at >= CURRENT_DATE)::BIGINT as today_count
  FROM orders o
  GROUP BY o.status;
$$;

-- 5. Scheduled cleanup function for sync_queue
CREATE OR REPLACE FUNCTION cleanup_sync_queue()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  -- Delete failed entries older than 7 days
  DELETE FROM sync_queue 
  WHERE status = 'failed' AND created_at < NOW() - INTERVAL '7 days';
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  
  -- Delete completed entries older than 1 day
  DELETE FROM sync_queue 
  WHERE status = 'completed' AND created_at < NOW() - INTERVAL '1 day';
  
  deleted_count := deleted_count + (SELECT ROW_COUNT);
  
  -- Delete processing entries older than 1 hour (stuck)
  DELETE FROM sync_queue 
  WHERE status = 'processing' AND updated_at < NOW() - INTERVAL '1 hour';
  
  RETURN deleted_count;
END;
$$;

-- 6. Deduplicate courier_tracking_history (keep first occurrence of each status per tracking)
DELETE FROM courier_tracking_history a
USING courier_tracking_history b
WHERE a.id > b.id
  AND a.tracking_id = b.tracking_id
  AND a.status = b.status
  AND a.current_location IS NOT DISTINCT FROM b.current_location
  AND DATE(a.checked_at) = DATE(b.checked_at);