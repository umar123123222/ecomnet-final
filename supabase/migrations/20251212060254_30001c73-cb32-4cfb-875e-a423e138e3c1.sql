-- Fix cleanup_sync_queue to be more aggressive
DROP FUNCTION IF EXISTS public.cleanup_sync_queue();

CREATE OR REPLACE FUNCTION public.cleanup_sync_queue()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  deleted_failed_old INTEGER;
  deleted_failed_retry INTEGER;
  deleted_completed INTEGER;
  deleted_stuck INTEGER;
BEGIN
  -- Delete failed items older than 7 days (regardless of retry count)
  DELETE FROM sync_queue WHERE status = 'failed' AND created_at < NOW() - INTERVAL '7 days';
  GET DIAGNOSTICS deleted_failed_old = ROW_COUNT;
  
  -- Delete failed items with retry_count >= 1 that are older than 3 days
  DELETE FROM sync_queue WHERE status = 'failed' AND retry_count >= 1 AND created_at < NOW() - INTERVAL '3 days';
  GET DIAGNOSTICS deleted_failed_retry = ROW_COUNT;
  
  -- Delete old completed items (older than 1 day instead of 3)
  DELETE FROM sync_queue WHERE status = 'completed' AND processed_at < NOW() - INTERVAL '1 day';
  GET DIAGNOSTICS deleted_completed = ROW_COUNT;
  
  -- Delete stuck processing items (older than 30 minutes instead of 1 hour)
  DELETE FROM sync_queue WHERE status = 'processing' AND created_at < NOW() - INTERVAL '30 minutes';
  GET DIAGNOSTICS deleted_stuck = ROW_COUNT;
  
  RETURN jsonb_build_object(
    'deleted_failed_old', deleted_failed_old,
    'deleted_failed_retry', deleted_failed_retry,
    'deleted_completed', deleted_completed,
    'deleted_stuck', deleted_stuck,
    'total_deleted', deleted_failed_old + deleted_failed_retry + deleted_completed + deleted_stuck
  );
END;
$function$;