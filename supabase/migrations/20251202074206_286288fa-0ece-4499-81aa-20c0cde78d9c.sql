-- Sync existing tracking_id and courier from orders to dispatches
UPDATE dispatches d
SET 
  tracking_id = o.tracking_id,
  courier = COALESCE(d.courier, o.courier::text),
  updated_at = NOW()
FROM orders o
WHERE d.order_id = o.id
  AND (d.tracking_id IS NULL OR d.tracking_id = '')
  AND o.tracking_id IS NOT NULL
  AND o.tracking_id != '';

-- Also sync courier field where missing
UPDATE dispatches d
SET 
  courier = o.courier::text,
  updated_at = NOW()
FROM orders o
WHERE d.order_id = o.id
  AND (d.courier IS NULL OR d.courier = '')
  AND o.courier IS NOT NULL;

-- Create function to sync tracking_id and courier from orders to dispatches
CREATE OR REPLACE FUNCTION sync_order_tracking_to_dispatch()
RETURNS TRIGGER AS $$
BEGIN
  -- When order's tracking_id is updated, sync to dispatch if dispatch has no tracking
  IF NEW.tracking_id IS NOT NULL AND NEW.tracking_id != '' AND 
     (OLD.tracking_id IS NULL OR OLD.tracking_id = '' OR OLD.tracking_id != NEW.tracking_id) THEN
    
    UPDATE dispatches 
    SET 
      tracking_id = NEW.tracking_id,
      courier = COALESCE(dispatches.courier, NEW.courier::text),
      updated_at = NOW()
    WHERE order_id = NEW.id
      AND (tracking_id IS NULL OR tracking_id = '');
  END IF;
  
  -- When order's courier is updated, sync to dispatch if dispatch has no courier
  IF NEW.courier IS NOT NULL AND 
     (OLD.courier IS NULL OR OLD.courier != NEW.courier) THEN
    
    UPDATE dispatches 
    SET 
      courier = NEW.courier::text,
      updated_at = NOW()
    WHERE order_id = NEW.id
      AND (courier IS NULL OR courier = '');
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger to automatically sync tracking when order is updated
DROP TRIGGER IF EXISTS trigger_sync_order_tracking ON orders;
CREATE TRIGGER trigger_sync_order_tracking
AFTER UPDATE OF tracking_id, courier ON orders
FOR EACH ROW
EXECUTE FUNCTION sync_order_tracking_to_dispatch();