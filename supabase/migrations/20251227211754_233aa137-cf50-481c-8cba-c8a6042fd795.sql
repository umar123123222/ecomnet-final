-- Fix order_count in daily_dispatch_summaries
-- The previous migration incorrectly used MAX(order_count) per product instead of COUNT(DISTINCT) across all products

UPDATE daily_dispatch_summaries dds
SET order_count = (
  SELECT COUNT(DISTINCT sm.reference_id)
  FROM stock_movements sm
  WHERE sm.movement_type = 'sale'
    AND DATE(sm.created_at AT TIME ZONE 'Asia/Karachi') = dds.summary_date
),
updated_at = NOW()
WHERE summary_date >= '2025-12-26';