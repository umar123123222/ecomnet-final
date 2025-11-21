-- Fix the queue_order_status_sync trigger to not pass old tags
-- Let the sync processor generate correct Ecomnet status tags

CREATE OR REPLACE FUNCTION public.queue_order_status_sync()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_priority TEXT := 'normal';
BEGIN
  -- Only queue sync if order has shopify_order_id AND status changed
  IF (OLD.status IS DISTINCT FROM NEW.status) AND 
     NEW.shopify_order_id IS NOT NULL AND
     (NEW.status IN ('confirmed', 'booked', 'dispatched', 'delivered', 'returned', 'cancelled')) THEN
    
    -- Set priority based on status
    IF NEW.status IN ('delivered', 'returned', 'cancelled') THEN
      v_priority := 'high';
    ELSIF NEW.status IN ('confirmed', 'booked') THEN
      v_priority := 'high';
    ELSIF NEW.status = 'dispatched' THEN
      v_priority := 'normal';
    END IF;
    
    -- Insert into sync queue with priority
    -- IMPORTANT: Only pass the new status, not the tags
    -- The process-sync-queue will generate the correct Ecomnet status tag
    INSERT INTO sync_queue (entity_type, entity_id, action, direction, payload, status, priority)
    VALUES (
      'order',
      NEW.id,
      'update',
      'to_shopify',
      jsonb_build_object(
        'order_id', NEW.id,
        'changes', jsonb_build_object(
          'status', NEW.status
          -- Do NOT include tags here - let processor generate them
        )
      ),
      'pending',
      v_priority
    )
    ON CONFLICT DO NOTHING;
    
    RAISE NOTICE 'Queued status sync for order % with priority %: % -> %', NEW.order_number, v_priority, OLD.status, NEW.status;
  END IF;
  
  RETURN NEW;
END;
$function$;