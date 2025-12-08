-- Backfill product_id in order_items by matching Shopify product_id
-- First, add shopify_product_id column to order_items for better tracking
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS shopify_product_id BIGINT;
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS shopify_variant_id BIGINT;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_order_items_shopify_product_id ON order_items(shopify_product_id);
CREATE INDEX IF NOT EXISTS idx_products_shopify_product_id ON products(shopify_product_id);

-- Backfill product_id by matching item_name to product name (case-insensitive exact match)
UPDATE order_items oi
SET product_id = p.id
FROM products p
WHERE oi.product_id IS NULL
  AND LOWER(TRIM(oi.item_name)) = LOWER(TRIM(p.name));

-- Also try matching by partial name (item_name contains product name)
UPDATE order_items oi
SET product_id = p.id
FROM products p
WHERE oi.product_id IS NULL
  AND LOWER(oi.item_name) LIKE '%' || LOWER(p.name) || '%';

-- Create function to match order items to products
CREATE OR REPLACE FUNCTION match_order_item_to_product(p_item_name TEXT, p_shopify_product_id BIGINT DEFAULT NULL)
RETURNS UUID
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_product_id UUID;
BEGIN
  -- Try matching by Shopify product ID first (most reliable)
  IF p_shopify_product_id IS NOT NULL THEN
    SELECT id INTO v_product_id
    FROM products
    WHERE shopify_product_id = p_shopify_product_id
    LIMIT 1;
    
    IF FOUND THEN
      RETURN v_product_id;
    END IF;
  END IF;
  
  -- Try exact name match (case-insensitive)
  SELECT id INTO v_product_id
  FROM products
  WHERE LOWER(TRIM(name)) = LOWER(TRIM(p_item_name))
  LIMIT 1;
  
  IF FOUND THEN
    RETURN v_product_id;
  END IF;
  
  -- Try partial match (item name contains product name)
  SELECT id INTO v_product_id
  FROM products
  WHERE LOWER(p_item_name) LIKE '%' || LOWER(name) || '%'
  ORDER BY LENGTH(name) DESC -- Prefer longer (more specific) matches
  LIMIT 1;
  
  RETURN v_product_id;
END;
$$;