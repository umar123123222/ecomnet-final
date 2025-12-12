-- Drop existing constraint and add new one with 'pending' status
ALTER TABLE purchase_orders DROP CONSTRAINT IF EXISTS purchase_orders_status_check;
ALTER TABLE purchase_orders ADD CONSTRAINT purchase_orders_status_check 
  CHECK (status IN ('draft', 'pending', 'sent', 'confirmed', 'in_transit', 'received', 'completed', 'cancelled'));

-- Update existing draft POs to pending
UPDATE purchase_orders SET status = 'pending' WHERE status = 'draft';