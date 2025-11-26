-- Add cancellation_reason column to orders table
ALTER TABLE orders ADD COLUMN IF NOT EXISTS cancellation_reason TEXT;

COMMENT ON COLUMN orders.cancellation_reason IS 'Reason for order cancellation: customer, fraud, inventory, declined, other';