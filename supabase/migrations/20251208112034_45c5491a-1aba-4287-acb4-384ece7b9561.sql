-- Delete all orders before November 21, 2025 and related data
-- Step 1: Delete courier tracking history for affected orders
DELETE FROM courier_tracking_history 
WHERE dispatch_id IN (
  SELECT d.id FROM dispatches d 
  JOIN orders o ON o.id = d.order_id 
  WHERE o.created_at < '2025-11-21 00:00:00'
);

-- Step 2: Delete dispatches for affected orders
DELETE FROM dispatches 
WHERE order_id IN (
  SELECT id FROM orders WHERE created_at < '2025-11-21 00:00:00'
);

-- Step 3: Delete order items
DELETE FROM order_items 
WHERE order_id IN (
  SELECT id FROM orders WHERE created_at < '2025-11-21 00:00:00'
);

-- Step 4: Delete order confirmations
DELETE FROM order_confirmations 
WHERE order_id IN (
  SELECT id FROM orders WHERE created_at < '2025-11-21 00:00:00'
);

-- Step 5: Delete order packaging records
DELETE FROM order_packaging 
WHERE order_id IN (
  SELECT id FROM orders WHERE created_at < '2025-11-21 00:00:00'
);

-- Step 6: Delete address verifications
DELETE FROM address_verifications
WHERE order_id IN (
  SELECT id FROM orders WHERE created_at < '2025-11-21 00:00:00'
);

-- Step 7: Delete conversations
DELETE FROM conversations
WHERE order_id IN (
  SELECT id FROM orders WHERE created_at < '2025-11-21 00:00:00'
);

-- Step 8: Delete activity logs for these orders (entity_id is UUID type)
DELETE FROM activity_logs
WHERE entity_type = 'order' AND entity_id::uuid IN (
  SELECT id FROM orders WHERE created_at < '2025-11-21 00:00:00'
);

-- Step 9: Delete the orders themselves
DELETE FROM orders WHERE created_at < '2025-11-21 00:00:00';