-- Fix trigger: Remove 'confirmed' status as it's not a valid order_status enum value
CREATE OR REPLACE FUNCTION auto_delete_dispatch_on_status_change()
RETURNS TRIGGER AS $$
BEGIN
  -- Check if status changed FROM dispatched TO pending only (confirmed is not a valid order_status)
  IF OLD.status = 'dispatched' AND NEW.status = 'pending' THEN
    -- Delete the dispatch record for this order
    DELETE FROM dispatches 
    WHERE order_id = NEW.id;
    
    -- Log for debugging
    RAISE NOTICE 'Deleted dispatch for order % due to status change from dispatched to %', NEW.order_number, NEW.status;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;