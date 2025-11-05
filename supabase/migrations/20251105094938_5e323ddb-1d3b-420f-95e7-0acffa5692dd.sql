-- Create partial unique index on customers.shopify_customer_id to support ON CONFLICT
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relname = 'customers_shopify_customer_id_key'
      AND n.nspname = 'public'
  ) THEN
    CREATE UNIQUE INDEX customers_shopify_customer_id_key
    ON public.customers (shopify_customer_id)
    WHERE shopify_customer_id IS NOT NULL;
  END IF;
END
$$;