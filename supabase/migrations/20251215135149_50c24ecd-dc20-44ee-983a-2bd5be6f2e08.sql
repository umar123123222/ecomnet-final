-- 1. Create archive table for completed sync items
CREATE TABLE IF NOT EXISTS public.sync_queue_archive (
  id UUID PRIMARY KEY,
  entity_type TEXT NOT NULL,
  entity_id UUID NOT NULL,
  action TEXT NOT NULL,
  direction TEXT NOT NULL,
  payload JSONB,
  status TEXT NOT NULL,
  priority TEXT,
  retry_count INTEGER DEFAULT 0,
  error_message TEXT,
  created_at TIMESTAMPTZ,
  processed_at TIMESTAMPTZ,
  archived_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for querying archived items
CREATE INDEX IF NOT EXISTS idx_sync_queue_archive_entity ON sync_queue_archive(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_sync_queue_archive_archived_at ON sync_queue_archive(archived_at);

-- 2. Archive completed items older than 7 days
INSERT INTO sync_queue_archive (id, entity_type, entity_id, action, direction, payload, status, priority, retry_count, error_message, created_at, processed_at)
SELECT id, entity_type, entity_id, action, direction, payload, status, priority, retry_count, error_message, created_at, processed_at
FROM sync_queue
WHERE status = 'completed' AND processed_at < NOW() - INTERVAL '7 days';

-- Delete archived completed items
DELETE FROM sync_queue
WHERE status = 'completed' AND processed_at < NOW() - INTERVAL '7 days';

-- 3. Delete permanently failed items (retry_count >= 3)
DELETE FROM sync_queue
WHERE status = 'failed' AND retry_count >= 3;

-- 4. Delete old processing items stuck for > 1 hour (likely orphaned)
DELETE FROM sync_queue
WHERE status = 'processing' AND created_at < NOW() - INTERVAL '1 hour';

-- 5. Drop and recreate the trigger with smarter logic
DROP TRIGGER IF EXISTS trigger_queue_order_status_sync ON orders;

CREATE OR REPLACE FUNCTION public.queue_order_status_sync()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_priority TEXT := 'normal';
  v_existing_pending UUID;
BEGIN
  -- Only queue sync if:
  -- 1. Order has shopify_order_id (can actually sync to Shopify)
  -- 2. Status actually changed
  -- 3. Status is one we care about syncing
  IF NEW.shopify_order_id IS NULL THEN
    RETURN NEW;
  END IF;
  
  IF OLD.status IS NOT DISTINCT FROM NEW.status THEN
    RETURN NEW;
  END IF;
  
  IF NEW.status NOT IN ('confirmed', 'booked', 'dispatched', 'delivered', 'returned', 'cancelled') THEN
    RETURN NEW;
  END IF;
  
  -- Prevent sync loop: skip if last_shopify_sync was within 30 seconds
  IF NEW.last_shopify_sync IS NOT NULL AND NEW.last_shopify_sync > NOW() - INTERVAL '30 seconds' THEN
    RETURN NEW;
  END IF;
  
  -- DEDUPLICATION: Check for existing pending/processing item for same entity
  SELECT id INTO v_existing_pending
  FROM sync_queue
  WHERE entity_type = 'order'
    AND entity_id = NEW.id
    AND status IN ('pending', 'processing')
  LIMIT 1;
  
  -- If pending item exists, update it instead of creating duplicate
  IF v_existing_pending IS NOT NULL THEN
    UPDATE sync_queue
    SET 
      payload = jsonb_build_object(
        'order_id', NEW.id,
        'changes', jsonb_build_object('status', NEW.status)
      ),
      priority = CASE 
        WHEN NEW.status IN ('delivered', 'returned', 'cancelled') THEN 'high'
        WHEN NEW.status IN ('confirmed', 'booked') THEN 'high'
        ELSE 'normal'
      END
    WHERE id = v_existing_pending;
    
    RETURN NEW;
  END IF;
  
  -- Set priority based on status
  IF NEW.status IN ('delivered', 'returned', 'cancelled') THEN
    v_priority := 'high';
  ELSIF NEW.status IN ('confirmed', 'booked') THEN
    v_priority := 'high';
  ELSIF NEW.status = 'dispatched' THEN
    v_priority := 'normal';
  END IF;
  
  -- Insert new sync queue item
  INSERT INTO sync_queue (entity_type, entity_id, action, direction, payload, status, priority)
  VALUES (
    'order',
    NEW.id,
    'update',
    'to_shopify',
    jsonb_build_object(
      'order_id', NEW.id,
      'changes', jsonb_build_object('status', NEW.status)
    ),
    'pending',
    v_priority
  );
  
  RETURN NEW;
END;
$function$;

-- Recreate trigger
CREATE TRIGGER trigger_queue_order_status_sync
  AFTER UPDATE ON orders
  FOR EACH ROW
  EXECUTE FUNCTION queue_order_status_sync();

-- 6. Create cleanup function for scheduled maintenance
CREATE OR REPLACE FUNCTION public.cleanup_sync_queue()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_archived INTEGER := 0;
  v_deleted_failed INTEGER := 0;
  v_deleted_orphaned INTEGER := 0;
BEGIN
  -- Archive completed items older than 7 days
  WITH archived AS (
    INSERT INTO sync_queue_archive (id, entity_type, entity_id, action, direction, payload, status, priority, retry_count, error_message, created_at, processed_at)
    SELECT id, entity_type, entity_id, action, direction, payload, status, priority, retry_count, error_message, created_at, processed_at
    FROM sync_queue
    WHERE status = 'completed' AND processed_at < NOW() - INTERVAL '7 days'
    RETURNING 1
  )
  SELECT COUNT(*) INTO v_archived FROM archived;
  
  DELETE FROM sync_queue
  WHERE status = 'completed' AND processed_at < NOW() - INTERVAL '7 days';
  
  -- Delete permanently failed items
  WITH deleted AS (
    DELETE FROM sync_queue
    WHERE status = 'failed' AND retry_count >= 3
    RETURNING 1
  )
  SELECT COUNT(*) INTO v_deleted_failed FROM deleted;
  
  -- Delete orphaned processing items
  WITH deleted AS (
    DELETE FROM sync_queue
    WHERE status = 'processing' AND created_at < NOW() - INTERVAL '1 hour'
    RETURNING 1
  )
  SELECT COUNT(*) INTO v_deleted_orphaned FROM deleted;
  
  RETURN jsonb_build_object(
    'archived', v_archived,
    'deleted_failed', v_deleted_failed,
    'deleted_orphaned', v_deleted_orphaned,
    'cleaned_at', NOW()
  );
END;
$function$;