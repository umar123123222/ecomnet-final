-- Clean up duplicate shopify_customer_id records before creating unique index
-- Keep the oldest record for each shopify_customer_id and merge data

-- Step 1: Create temp table with customers to keep (oldest per shopify_customer_id)
CREATE TEMP TABLE customers_to_keep AS
SELECT DISTINCT ON (shopify_customer_id) 
  id, 
  shopify_customer_id
FROM public.customers
WHERE shopify_customer_id IS NOT NULL
ORDER BY shopify_customer_id, created_at ASC;

-- Step 2: Update orders to point to the kept customer record
UPDATE public.orders o
SET customer_id = ctk.id
FROM public.customers c
JOIN customers_to_keep ctk ON c.shopify_customer_id = ctk.shopify_customer_id
WHERE o.customer_id = c.id
  AND c.id != ctk.id
  AND c.shopify_customer_id IS NOT NULL;

-- Step 3: Update conversations to point to the kept customer record
UPDATE public.conversations conv
SET customer_id = ctk.id
FROM public.customers c
JOIN customers_to_keep ctk ON c.shopify_customer_id = ctk.shopify_customer_id
WHERE conv.customer_id = c.id
  AND c.id != ctk.id
  AND c.shopify_customer_id IS NOT NULL;

-- Step 4: Delete duplicate customer records
DELETE FROM public.customers c
WHERE c.shopify_customer_id IS NOT NULL
  AND c.id NOT IN (SELECT id FROM customers_to_keep);

-- Step 5: Now create the unique index
CREATE UNIQUE INDEX customers_shopify_unique 
ON public.customers (shopify_customer_id) 
WHERE shopify_customer_id IS NOT NULL;