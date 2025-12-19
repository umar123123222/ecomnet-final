-- Fix search_path for prevent_cancel_after_return function
CREATE OR REPLACE FUNCTION prevent_cancel_after_return()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- If trying to change status to 'cancelled' from any status
  IF NEW.status = 'cancelled' AND OLD.status != 'cancelled' THEN
    -- Check if there's a received return for this order
    IF EXISTS (SELECT 1 FROM returns WHERE order_id = NEW.id AND received_at IS NOT NULL) THEN
      RAISE EXCEPTION 'Cannot cancel order % - it has already been returned and received', NEW.order_number;
    END IF;
  END IF;
  
  -- If trying to change status away from 'returned' to something other than delivered
  IF OLD.status = 'returned' AND NEW.status NOT IN ('returned', 'delivered') THEN
    IF EXISTS (SELECT 1 FROM returns WHERE order_id = NEW.id AND received_at IS NOT NULL) THEN
      RAISE EXCEPTION 'Cannot change status of order % from returned - it has a received return record', NEW.order_number;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;