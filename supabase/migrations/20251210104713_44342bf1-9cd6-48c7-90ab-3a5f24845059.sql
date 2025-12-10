-- Update all orders that have received returns but are not marked as returned
UPDATE orders 
SET status = 'returned'
FROM returns r 
WHERE orders.id = r.order_id 
  AND r.received_at IS NOT NULL 
  AND orders.status != 'returned';

-- Create a trigger to automatically update order status when return is received
CREATE OR REPLACE FUNCTION sync_order_status_on_return()
RETURNS TRIGGER AS $$
BEGIN
  -- When a return is marked as received, update the order status
  IF NEW.received_at IS NOT NULL AND (OLD.received_at IS NULL OR OLD.received_at != NEW.received_at) THEN
    UPDATE orders 
    SET status = 'returned'
    WHERE id = NEW.order_id 
      AND status != 'returned';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public';

-- Create trigger on returns table
DROP TRIGGER IF EXISTS trigger_sync_order_status_on_return ON returns;
CREATE TRIGGER trigger_sync_order_status_on_return
  AFTER INSERT OR UPDATE ON returns
  FOR EACH ROW
  EXECUTE FUNCTION sync_order_status_on_return();