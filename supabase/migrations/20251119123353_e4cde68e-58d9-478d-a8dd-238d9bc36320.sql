-- Create function to auto-delete dispatch when order status changes from dispatched to pending/confirmed
CREATE OR REPLACE FUNCTION auto_delete_dispatch_on_status_change()
RETURNS TRIGGER AS $$
BEGIN
  -- Check if status changed FROM dispatched TO pending or confirmed
  IF OLD.status = 'dispatched' AND NEW.status IN ('pending', 'confirmed') THEN
    -- Delete the dispatch record for this order
    DELETE FROM dispatches 
    WHERE order_id = NEW.id;
    
    -- Log for debugging
    RAISE NOTICE 'Deleted dispatch for order % due to status change from dispatched to %', NEW.order_number, NEW.status;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger on orders table
DROP TRIGGER IF EXISTS trigger_auto_delete_dispatch ON orders;

CREATE TRIGGER trigger_auto_delete_dispatch
  AFTER UPDATE OF status ON orders
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION auto_delete_dispatch_on_status_change();