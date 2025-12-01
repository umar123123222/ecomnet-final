-- Reset all delivered orders to their previous status
-- This migration intelligently determines the previous status based on:
-- 1. If dispatched (has dispatch record) -> dispatched
-- 2. If booked (has courier but no dispatch) -> booked
-- 3. Otherwise -> pending

-- Update orders with dispatch records back to dispatched
UPDATE orders
SET 
  status = 'dispatched',
  delivered_at = NULL,
  tags = ARRAY(
    SELECT t FROM unnest(tags) AS t WHERE t NOT LIKE 'Ecomnet - %'
  ) || ARRAY['Ecomnet - Dispatched']
WHERE status = 'delivered'
  AND id IN (SELECT order_id FROM dispatches);

-- Update orders with courier but no dispatch back to booked
UPDATE orders
SET 
  status = 'booked',
  delivered_at = NULL,
  tags = ARRAY(
    SELECT t FROM unnest(tags) AS t WHERE t NOT LIKE 'Ecomnet - %'
  ) || ARRAY['Ecomnet - Booked']
WHERE status = 'delivered'
  AND courier IS NOT NULL
  AND id NOT IN (SELECT order_id FROM dispatches);

-- Update remaining delivered orders (no courier, no dispatch) back to pending
UPDATE orders
SET 
  status = 'pending',
  delivered_at = NULL,
  tags = ARRAY(
    SELECT t FROM unnest(tags) AS t WHERE t NOT LIKE 'Ecomnet - %'
  ) || ARRAY['Ecomnet - Pending']
WHERE status = 'delivered'
  AND courier IS NULL;