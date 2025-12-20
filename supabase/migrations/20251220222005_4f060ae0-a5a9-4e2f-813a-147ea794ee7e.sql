-- Fix the specific order with wrong delivered_at date
-- Actual delivery was Nov 26, 2025 based on tracking history
UPDATE orders 
SET delivered_at = '2025-11-26T05:09:00.000Z'
WHERE id = 'dfab997b-85f0-43be-b848-e62b89298bde'
  AND tracking_id = '173008407302';