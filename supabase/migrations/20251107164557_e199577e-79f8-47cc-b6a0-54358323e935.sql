-- Drop trigger that depends on the status column
DROP TRIGGER IF EXISTS audit_orders_changes ON orders;

-- Update any existing orders with old statuses to map to new ones
UPDATE orders
SET status = CASE
  WHEN status IN ('address clear', 'unclear address') THEN 'pending'
  ELSE status::text
END::order_status
WHERE status IN ('address clear', 'unclear address');

-- Drop and recreate the enum with 6 values
ALTER TABLE orders ALTER COLUMN status TYPE text;
DROP TYPE IF EXISTS order_status CASCADE;
CREATE TYPE order_status AS ENUM ('pending', 'booked', 'dispatched', 'delivered', 'returned', 'cancelled');
ALTER TABLE orders ALTER COLUMN status TYPE order_status USING status::order_status;
ALTER TABLE orders ALTER COLUMN status SET DEFAULT 'pending'::order_status;

-- Recreate the audit trigger if it existed
-- Note: The trigger function should still exist, we only dropped the trigger itself