-- Option B: Delete return records where order status is not 'returned'
-- These are orphaned/invalid returns that shouldn't exist
DELETE FROM returns
WHERE order_id IN (
  SELECT r.order_id 
  FROM returns r 
  JOIN orders o ON r.order_id = o.id 
  WHERE o.status != 'returned'
);

-- Option C: Create trigger to prevent cancelling orders that have received returns
CREATE OR REPLACE FUNCTION prevent_cancel_after_return()
RETURNS TRIGGER AS $$
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
$$ LANGUAGE plpgsql;

-- Create the trigger on orders table
DROP TRIGGER IF EXISTS prevent_cancel_after_return_trigger ON orders;
CREATE TRIGGER prevent_cancel_after_return_trigger
  BEFORE UPDATE ON orders
  FOR EACH ROW
  EXECUTE FUNCTION prevent_cancel_after_return();