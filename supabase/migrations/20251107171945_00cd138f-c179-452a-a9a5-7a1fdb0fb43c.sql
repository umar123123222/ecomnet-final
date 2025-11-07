-- Clean up existing NULL and 'N/A' values to empty string
UPDATE orders 
SET customer_phone = '' 
WHERE customer_phone IS NULL OR customer_phone = 'N/A';

-- Remove the default but keep nullable
ALTER TABLE orders ALTER COLUMN customer_phone DROP DEFAULT;

-- Add a comment for documentation
COMMENT ON COLUMN orders.customer_phone IS 'Customer phone number. Empty string if not provided. Nullable to handle Shopify orders without phone numbers.';
