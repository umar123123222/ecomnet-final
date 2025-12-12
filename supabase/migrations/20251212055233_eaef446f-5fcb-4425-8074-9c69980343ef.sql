
-- Drop existing function with wrong return type
DROP FUNCTION IF EXISTS public.cleanup_sync_queue();

-- Create cleanup function for sync_queue that can be called via RPC
CREATE OR REPLACE FUNCTION public.cleanup_sync_queue()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  deleted_failed INTEGER;
  deleted_completed INTEGER;
  deleted_stuck INTEGER;
BEGIN
  -- Delete failed items with 3+ retries
  DELETE FROM sync_queue WHERE status = 'failed' AND retry_count >= 3;
  GET DIAGNOSTICS deleted_failed = ROW_COUNT;
  
  -- Delete old completed items (older than 3 days)
  DELETE FROM sync_queue WHERE status = 'completed' AND processed_at < NOW() - INTERVAL '3 days';
  GET DIAGNOSTICS deleted_completed = ROW_COUNT;
  
  -- Delete stuck processing items (older than 1 hour)
  DELETE FROM sync_queue WHERE status = 'processing' AND created_at < NOW() - INTERVAL '1 hour';
  GET DIAGNOSTICS deleted_stuck = ROW_COUNT;
  
  RETURN jsonb_build_object(
    'deleted_failed', deleted_failed,
    'deleted_completed', deleted_completed,
    'deleted_stuck', deleted_stuck,
    'total_deleted', deleted_failed + deleted_completed + deleted_stuck
  );
END;
$function$;
