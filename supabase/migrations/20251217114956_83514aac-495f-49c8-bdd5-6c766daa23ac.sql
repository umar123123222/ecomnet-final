-- Add courier fee columns to orders table for actual charges from payment reconciliation
ALTER TABLE orders 
ADD COLUMN IF NOT EXISTS courier_delivery_fee NUMERIC DEFAULT NULL,
ADD COLUMN IF NOT EXISTS courier_return_fee NUMERIC DEFAULT NULL;

-- Add comments for documentation
COMMENT ON COLUMN orders.courier_delivery_fee IS 'Actual delivery fee charged by courier (from payment reconciliation)';
COMMENT ON COLUMN orders.courier_return_fee IS 'Actual return fee charged by courier (from payment reconciliation)';