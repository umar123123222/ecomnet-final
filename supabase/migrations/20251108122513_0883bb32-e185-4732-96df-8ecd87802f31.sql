-- Fix search_path for the new trigger function
CREATE OR REPLACE FUNCTION update_courier_booking_queue_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;