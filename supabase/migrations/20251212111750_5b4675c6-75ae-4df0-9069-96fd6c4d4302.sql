-- Merge duplicate customers by normalized phone
-- Step 1: Create temp table with primary customer IDs (keep the one with shopify_customer_id, or oldest if neither has it)
CREATE TEMP TABLE customer_duplicates AS
WITH normalized AS (
  SELECT 
    id,
    shopify_customer_id,
    regexp_replace(COALESCE(phone, ''), '[^0-9]', '', 'g') as normalized_phone,
    created_at
  FROM customers
  WHERE phone IS NOT NULL AND phone != ''
),
ranked AS (
  SELECT 
    id,
    normalized_phone,
    ROW_NUMBER() OVER (
      PARTITION BY normalized_phone 
      ORDER BY 
        CASE WHEN shopify_customer_id IS NOT NULL THEN 0 ELSE 1 END,
        created_at ASC
    ) as rn
  FROM normalized
  WHERE normalized_phone != ''
)
SELECT 
  r1.normalized_phone,
  r1.id as primary_id,
  r2.id as duplicate_id
FROM ranked r1
JOIN ranked r2 ON r1.normalized_phone = r2.normalized_phone AND r2.rn > 1
WHERE r1.rn = 1;

-- Step 2: Update orders to point to primary customer
UPDATE orders o
SET customer_id = cd.primary_id
FROM customer_duplicates cd
WHERE o.customer_id = cd.duplicate_id;

-- Step 3: Update order_confirmations to point to primary customer
UPDATE order_confirmations oc
SET customer_id = cd.primary_id
FROM customer_duplicates cd
WHERE oc.customer_id = cd.duplicate_id;

-- Step 4: Update conversations to point to primary customer
UPDATE conversations c
SET customer_id = cd.primary_id
FROM customer_duplicates cd
WHERE c.customer_id = cd.duplicate_id;

-- Step 5: Merge customer data (aggregate totals, take non-null values)
UPDATE customers c
SET 
  total_orders = COALESCE(c.total_orders, 0) + COALESCE(dup.total_orders, 0),
  delivered_count = COALESCE(c.delivered_count, 0) + COALESCE(dup.delivered_count, 0),
  return_count = COALESCE(c.return_count, 0) + COALESCE(dup.return_count, 0),
  email = COALESCE(c.email, dup.email),
  address = COALESCE(c.address, dup.address),
  city = COALESCE(c.city, dup.city),
  shopify_customer_id = COALESCE(c.shopify_customer_id, dup.shopify_customer_id),
  -- Normalize the phone number
  phone = regexp_replace(COALESCE(c.phone, dup.phone, ''), '[^0-9]', '', 'g'),
  phone_last_5_chr = RIGHT(regexp_replace(COALESCE(c.phone, dup.phone, ''), '[^0-9]', '', 'g'), 5),
  updated_at = NOW()
FROM customer_duplicates cd
JOIN customers dup ON dup.id = cd.duplicate_id
WHERE c.id = cd.primary_id;

-- Step 6: Delete duplicate customers
DELETE FROM customers c
USING customer_duplicates cd
WHERE c.id = cd.duplicate_id;

-- Step 7: Normalize all existing phone numbers that still have + or other characters
UPDATE customers
SET 
  phone = regexp_replace(phone, '[^0-9]', '', 'g'),
  phone_last_5_chr = RIGHT(regexp_replace(phone, '[^0-9]', '', 'g'), 5)
WHERE phone IS NOT NULL 
  AND phone != ''
  AND phone ~ '[^0-9]';

-- Drop temp table
DROP TABLE customer_duplicates;