
-- Recalculate daily_dispatch_summaries for Dec 26-27, 2025
DELETE FROM daily_dispatch_summaries 
WHERE summary_date >= '2025-12-26' AND summary_date <= '2025-12-27';

INSERT INTO daily_dispatch_summaries (summary_date, product_items, total_product_units, unique_products, order_count, updated_at)
SELECT 
  summary_date,
  jsonb_object_agg(
    product_id::text,
    jsonb_build_object(
      'name', product_name,
      'sku', product_sku,
      'total_qty', total_qty
    )
  ) as product_items,
  SUM(total_qty)::integer as total_product_units,
  COUNT(DISTINCT product_id)::integer as unique_products,
  MAX(order_count)::integer as order_count,
  NOW()
FROM (
  SELECT 
    DATE(sm.created_at AT TIME ZONE 'Asia/Karachi') as summary_date,
    sm.product_id,
    p.name as product_name,
    COALESCE(p.sku, '') as product_sku,
    ABS(SUM(sm.quantity))::integer as total_qty,
    COUNT(DISTINCT sm.reference_id) as order_count
  FROM stock_movements sm
  JOIN products p ON p.id = sm.product_id
  WHERE sm.movement_type = 'sale'
    AND DATE(sm.created_at AT TIME ZONE 'Asia/Karachi') IN ('2025-12-26', '2025-12-27')
  GROUP BY DATE(sm.created_at AT TIME ZONE 'Asia/Karachi'), sm.product_id, p.name, p.sku
) sub
GROUP BY summary_date;
