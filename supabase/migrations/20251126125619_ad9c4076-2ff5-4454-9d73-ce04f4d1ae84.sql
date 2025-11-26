-- Create a function to enforce courier assignment rules
CREATE OR REPLACE FUNCTION enforce_courier_status_rules()
RETURNS TRIGGER AS $$
BEGIN
  -- Rule 1: If courier is assigned (not null), status must be 'booked'
  IF NEW.courier IS NOT NULL THEN
    -- Only auto-update if current status is 'pending' or 'confirmed'
    -- Don't override if already dispatched/delivered/cancelled/returned
    IF (OLD.status IN ('pending', 'confirmed') OR OLD.status IS NULL) AND NEW.status NOT IN ('dispatched', 'delivered', 'cancelled', 'returned') THEN
      NEW.status := 'booked';
      NEW.booked_at := COALESCE(NEW.booked_at, NOW());
    END IF;
  END IF;
  
  -- Rule 2: If courier is removed (set to null), reset to 'pending' if currently 'booked'
  IF NEW.courier IS NULL AND OLD.courier IS NOT NULL THEN
    IF OLD.status = 'booked' AND NEW.status = OLD.status THEN
      NEW.status := 'pending';
      NEW.booked_at := NULL;
      NEW.tracking_id := NULL;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS trigger_enforce_courier_status ON orders;

-- Create the trigger
CREATE TRIGGER trigger_enforce_courier_status
  BEFORE INSERT OR UPDATE ON orders
  FOR EACH ROW
  EXECUTE FUNCTION enforce_courier_status_rules();