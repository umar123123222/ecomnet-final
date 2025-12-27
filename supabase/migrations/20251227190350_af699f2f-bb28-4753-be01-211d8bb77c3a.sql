-- Step 1: Delete the incorrectly dated stock movement (created today with NOW())
DELETE FROM stock_movements 
WHERE reference_id = (SELECT id FROM orders WHERE order_number = '342268' LIMIT 1)
  AND movement_type = 'sale'
  AND created_at >= '2025-12-27 00:00:00+00';

-- Step 2: Recreate the stock movement with the correct Dec 26 date
INSERT INTO stock_movements (product_id, outlet_id, quantity, movement_type, reference_id, notes, created_by, created_at)
SELECT 
  oi.product_id,
  (SELECT id FROM outlets WHERE outlet_type = 'warehouse' ORDER BY created_at ASC LIMIT 1),
  -oi.quantity,
  'sale',
  o.id,
  'Backfill: Order ' || o.order_number || ' dispatched on Dec 26',
  (SELECT dispatched_by FROM dispatches WHERE order_id = o.id LIMIT 1),
  o.dispatched_at  -- Use actual dispatch time (Dec 26)
FROM orders o
JOIN order_items oi ON oi.order_id = o.id
WHERE o.order_number = '342268'
  AND oi.product_id IS NOT NULL;

-- Step 3: Recalculate daily_dispatch_summaries for Dec 26 (add the missing order)
UPDATE daily_dispatch_summaries
SET 
  order_count = order_count + 1,
  total_product_units = total_product_units + (
    SELECT COALESCE(SUM(oi.quantity), 0)
    FROM orders o
    JOIN order_items oi ON oi.order_id = o.id
    WHERE o.order_number = '342268'
  ),
  updated_at = NOW()
WHERE summary_date = '2025-12-26';

-- Step 4: Recalculate daily_dispatch_summaries for Dec 27 (remove the wrongly added order)
UPDATE daily_dispatch_summaries
SET 
  order_count = order_count - 1,
  total_product_units = total_product_units - (
    SELECT COALESCE(SUM(oi.quantity), 0)
    FROM orders o
    JOIN order_items oi ON oi.order_id = o.id
    WHERE o.order_number = '342268'
  ),
  updated_at = NOW()
WHERE summary_date = '2025-12-27';