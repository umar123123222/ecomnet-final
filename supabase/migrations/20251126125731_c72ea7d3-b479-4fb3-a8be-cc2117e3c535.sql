-- Fix search_path security issue for the courier status rules function
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
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public';