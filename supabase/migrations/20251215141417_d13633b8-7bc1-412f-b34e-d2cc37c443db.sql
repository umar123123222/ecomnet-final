-- Delete orphaned dispatch records where:
-- 1. tracking_id is NULL
-- 2. Associated order is cancelled or returned
DELETE FROM dispatches
WHERE tracking_id IS NULL
  AND order_id IN (
    SELECT o.id FROM orders o
    WHERE o.status IN ('cancelled', 'returned')
  );