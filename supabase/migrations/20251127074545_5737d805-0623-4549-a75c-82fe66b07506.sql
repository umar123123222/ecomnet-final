-- Delete all orders and related records created before November 15, 2025
-- This operation is irreversible

-- Step 1: Delete related records from child tables (respecting foreign key constraints)

-- Delete order items
DELETE FROM order_items 
WHERE order_id IN (SELECT id FROM orders WHERE created_at < '2025-11-15 00:00:00+00');

-- Delete dispatches
DELETE FROM dispatches 
WHERE order_id IN (SELECT id FROM orders WHERE created_at < '2025-11-15 00:00:00+00');

-- Delete courier booking attempts
DELETE FROM courier_booking_attempts 
WHERE order_id IN (SELECT id FROM orders WHERE created_at < '2025-11-15 00:00:00+00');

-- Delete courier tracking history
DELETE FROM courier_tracking_history 
WHERE order_id IN (SELECT id FROM orders WHERE created_at < '2025-11-15 00:00:00+00');

-- Delete order confirmations
DELETE FROM order_confirmations 
WHERE order_id IN (SELECT id FROM orders WHERE created_at < '2025-11-15 00:00:00+00');

-- Delete address verifications
DELETE FROM address_verifications 
WHERE order_id IN (SELECT id FROM orders WHERE created_at < '2025-11-15 00:00:00+00');

-- Delete conversations
DELETE FROM conversations 
WHERE order_id IN (SELECT id FROM orders WHERE created_at < '2025-11-15 00:00:00+00');

-- Delete order update failures
DELETE FROM order_update_failures 
WHERE order_id IN (SELECT id FROM orders WHERE created_at < '2025-11-15 00:00:00+00');

-- Delete courier booking queue
DELETE FROM courier_booking_queue 
WHERE order_id IN (SELECT id FROM orders WHERE created_at < '2025-11-15 00:00:00+00');

-- Step 2: Finally delete the orders
DELETE FROM orders 
WHERE created_at < '2025-11-15 00:00:00+00';