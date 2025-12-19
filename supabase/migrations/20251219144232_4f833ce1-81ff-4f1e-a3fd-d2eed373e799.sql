-- Step 1: Backfill orders with dispatch records but missing dispatched_at
UPDATE orders o
SET dispatched_at = d.dispatch_date
FROM dispatches d
WHERE d.order_id = o.id
  AND o.dispatched_at IS NULL
  AND d.dispatch_date IS NOT NULL;

-- Step 2: Create trigger function to sync dispatched_at on new dispatch records
CREATE OR REPLACE FUNCTION sync_dispatched_at_on_dispatch()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Update order's dispatched_at when a dispatch is created
  UPDATE orders 
  SET dispatched_at = COALESCE(NEW.dispatch_date, NOW())
  WHERE id = NEW.order_id 
    AND dispatched_at IS NULL;
  RETURN NEW;
END;
$$;

-- Step 3: Create the trigger
DROP TRIGGER IF EXISTS sync_dispatched_at_trigger ON dispatches;
CREATE TRIGGER sync_dispatched_at_trigger
AFTER INSERT ON dispatches
FOR EACH ROW
EXECUTE FUNCTION sync_dispatched_at_on_dispatch();