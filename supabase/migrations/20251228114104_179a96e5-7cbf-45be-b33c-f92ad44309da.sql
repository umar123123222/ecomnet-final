-- Backfill packaging_items in daily_dispatch_summaries for Dec 26 and 27, 2025
-- These dates have packaging_movements but the summary wasn't populated

-- Update Dec 26
UPDATE daily_dispatch_summaries
SET 
  packaging_items = (
    SELECT jsonb_object_agg(
      pm.packaging_item_id::TEXT,
      jsonb_build_object(
        'name', COALESCE(pi.name, 'Unknown'),
        'sku', COALESCE(pi.sku, ''),
        'total_qty', pm.total_qty
      )
    )
    FROM (
      SELECT packaging_item_id, SUM(ABS(quantity)) as total_qty
      FROM packaging_movements
      WHERE movement_type = 'dispatch'
        AND DATE(created_at AT TIME ZONE 'Asia/Karachi') = '2025-12-26'
      GROUP BY packaging_item_id
    ) pm
    JOIN packaging_items pi ON pi.id = pm.packaging_item_id
  ),
  total_packaging_units = (
    SELECT COALESCE(SUM(ABS(quantity)), 0)
    FROM packaging_movements
    WHERE movement_type = 'dispatch'
      AND DATE(created_at AT TIME ZONE 'Asia/Karachi') = '2025-12-26'
  ),
  unique_packaging = (
    SELECT COUNT(DISTINCT packaging_item_id)
    FROM packaging_movements
    WHERE movement_type = 'dispatch'
      AND DATE(created_at AT TIME ZONE 'Asia/Karachi') = '2025-12-26'
  ),
  updated_at = NOW()
WHERE summary_date = '2025-12-26';

-- Update Dec 27
UPDATE daily_dispatch_summaries
SET 
  packaging_items = (
    SELECT jsonb_object_agg(
      pm.packaging_item_id::TEXT,
      jsonb_build_object(
        'name', COALESCE(pi.name, 'Unknown'),
        'sku', COALESCE(pi.sku, ''),
        'total_qty', pm.total_qty
      )
    )
    FROM (
      SELECT packaging_item_id, SUM(ABS(quantity)) as total_qty
      FROM packaging_movements
      WHERE movement_type = 'dispatch'
        AND DATE(created_at AT TIME ZONE 'Asia/Karachi') = '2025-12-27'
      GROUP BY packaging_item_id
    ) pm
    JOIN packaging_items pi ON pi.id = pm.packaging_item_id
  ),
  total_packaging_units = (
    SELECT COALESCE(SUM(ABS(quantity)), 0)
    FROM packaging_movements
    WHERE movement_type = 'dispatch'
      AND DATE(created_at AT TIME ZONE 'Asia/Karachi') = '2025-12-27'
  ),
  unique_packaging = (
    SELECT COUNT(DISTINCT packaging_item_id)
    FROM packaging_movements
    WHERE movement_type = 'dispatch'
      AND DATE(created_at AT TIME ZONE 'Asia/Karachi') = '2025-12-27'
  ),
  updated_at = NOW()
WHERE summary_date = '2025-12-27';