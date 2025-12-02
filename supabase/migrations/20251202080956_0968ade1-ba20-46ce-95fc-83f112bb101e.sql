-- Add shipping_charges column to orders table
ALTER TABLE orders ADD COLUMN IF NOT EXISTS shipping_charges NUMERIC DEFAULT 0;

-- Add comment for documentation
COMMENT ON COLUMN orders.shipping_charges IS 'Shipping charges from Shopify, stored separately from product total';