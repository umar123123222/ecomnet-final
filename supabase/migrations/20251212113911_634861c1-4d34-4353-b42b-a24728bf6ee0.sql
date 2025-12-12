-- Phase 1: Clean up sync_queue bloat
-- Mark old failed items as permanently failed (stops retrying)
UPDATE sync_queue 
SET retry_count = 5
WHERE retry_count >= 1 
  AND retry_count < 5
  AND created_at < now() - interval '3 days'
  AND status = 'failed';

-- Delete very old failed items (>7 days)
DELETE FROM sync_queue 
WHERE status = 'failed' 
  AND created_at < now() - interval '7 days';

-- Delete old completed items (>1 day)
DELETE FROM sync_queue 
WHERE status = 'completed' 
  AND created_at < now() - interval '1 day';

-- Delete stale pending items (>7 days old)
DELETE FROM sync_queue 
WHERE status = 'pending' 
  AND created_at < now() - interval '7 days';

-- Delete stuck processing items (>30 minutes - use created_at since no updated_at)
UPDATE sync_queue 
SET status = 'failed', retry_count = 5, error_message = 'Stuck in processing state'
WHERE status = 'processing' 
  AND created_at < now() - interval '30 minutes';

-- Phase 3: Create missing RPC function for tracking
CREATE OR REPLACE FUNCTION get_dispatches_for_tracking(
  p_limit INTEGER DEFAULT 500,
  p_days_back INTEGER DEFAULT 7
)
RETURNS TABLE (
  dispatch_id UUID,
  order_id UUID,
  order_number TEXT,
  order_status order_status,
  tracking_id TEXT,
  courier TEXT,
  courier_id UUID,
  courier_code TEXT,
  last_tracking_update TIMESTAMPTZ
) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    d.id as dispatch_id,
    d.order_id,
    o.order_number,
    o.status as order_status,
    d.tracking_id,
    d.courier,
    d.courier_id,
    c.code as courier_code,
    d.last_tracking_update
  FROM dispatches d
  INNER JOIN orders o ON o.id = d.order_id
  LEFT JOIN couriers c ON c.id = d.courier_id
  WHERE d.tracking_id IS NOT NULL
    AND d.tracking_id != ''
    AND o.status = 'dispatched'
    AND o.updated_at > now() - (p_days_back || ' days')::INTERVAL
  ORDER BY d.last_tracking_update ASC NULLS FIRST
  LIMIT p_limit;
END;
$$;

-- Create RPC function to update dispatch tracking efficiently
CREATE OR REPLACE FUNCTION update_dispatch_tracking(
  p_dispatch_id UUID,
  p_status TEXT,
  p_location TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  UPDATE dispatches 
  SET 
    last_tracking_update = now(),
    updated_at = now()
  WHERE id = p_dispatch_id;
END;
$$;

-- Add index for faster sync_queue cleanup and processing
CREATE INDEX IF NOT EXISTS idx_sync_queue_status_created 
ON sync_queue (status, created_at);

CREATE INDEX IF NOT EXISTS idx_sync_queue_retry_cleanup 
ON sync_queue (status, retry_count, created_at) 
WHERE status = 'failed';