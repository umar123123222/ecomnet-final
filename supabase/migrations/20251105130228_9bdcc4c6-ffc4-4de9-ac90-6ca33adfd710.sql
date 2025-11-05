-- Step 1: Consolidate duplicate shopify_customer_id entries
-- Keep the oldest customer record per shopify_customer_id and re-point dependencies

-- Create a temporary table to hold the customer IDs we want to keep (oldest per shopify_customer_id)
CREATE TEMP TABLE customers_to_keep AS
SELECT DISTINCT ON (shopify_customer_id) id as keep_id, shopify_customer_id
FROM public.customers
WHERE shopify_customer_id IS NOT NULL
ORDER BY shopify_customer_id, created_at ASC;

-- Update orders to point to the kept customer records
UPDATE public.orders o
SET customer_id = ctk.keep_id
FROM public.customers c
JOIN customers_to_keep ctk ON c.shopify_customer_id = ctk.shopify_customer_id
WHERE o.customer_id = c.id
  AND c.id != ctk.keep_id
  AND c.shopify_customer_id IS NOT NULL;

-- Update conversations to point to the kept customer records
UPDATE public.conversations conv
SET customer_id = ctk.keep_id
FROM public.customers c
JOIN customers_to_keep ctk ON c.shopify_customer_id = ctk.shopify_customer_id
WHERE conv.customer_id = c.id
  AND c.id != ctk.keep_id
  AND c.shopify_customer_id IS NOT NULL;

-- Delete duplicate customer records (keep only the oldest)
DELETE FROM public.customers c
USING customers_to_keep ctk
WHERE c.shopify_customer_id = ctk.shopify_customer_id
  AND c.id != ctk.keep_id
  AND c.shopify_customer_id IS NOT NULL;

-- Step 2: Create partial unique index on shopify_customer_id
CREATE UNIQUE INDEX IF NOT EXISTS customers_shopify_customer_id_key 
ON public.customers (shopify_customer_id) 
WHERE shopify_customer_id IS NOT NULL;