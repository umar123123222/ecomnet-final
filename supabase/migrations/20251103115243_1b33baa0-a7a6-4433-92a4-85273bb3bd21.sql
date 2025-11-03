-- Add validation trigger to ensure inventory consistency
CREATE OR REPLACE FUNCTION check_inventory_consistency()
RETURNS TRIGGER AS $$
BEGIN
  -- Prevent negative reserved quantity
  IF NEW.reserved_quantity < 0 THEN
    RAISE EXCEPTION 'Reserved quantity cannot be negative (got: %)', NEW.reserved_quantity;
  END IF;
  
  -- Prevent reserved quantity exceeding total quantity
  IF NEW.reserved_quantity > NEW.quantity THEN
    RAISE EXCEPTION 'Reserved quantity (%) cannot exceed total quantity (%)', 
      NEW.reserved_quantity, NEW.quantity;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to validate inventory on insert and update
DROP TRIGGER IF EXISTS validate_inventory_reservation ON inventory;
CREATE TRIGGER validate_inventory_reservation
  BEFORE INSERT OR UPDATE ON inventory
  FOR EACH ROW
  EXECUTE FUNCTION check_inventory_consistency();

-- Add comment to explain the trigger
COMMENT ON TRIGGER validate_inventory_reservation ON inventory IS 
  'Validates that reserved_quantity is non-negative and does not exceed total quantity';
