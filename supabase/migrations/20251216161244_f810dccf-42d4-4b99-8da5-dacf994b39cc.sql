-- Fix inflated daily_dispatch_summaries data caused by cartesian join bug
-- Step 1: Truncate the table to remove bad data
TRUNCATE TABLE daily_dispatch_summaries;

-- Step 2: Correctly aggregate historical product dispatch data
WITH product_daily_totals AS (
  SELECT 
    (sm.created_at AT TIME ZONE 'Asia/Karachi')::DATE as summary_date,
    sm.product_id,
    p.name as product_name,
    p.sku as product_sku,
    SUM(ABS(sm.quantity)) as total_qty,
    COUNT(*) as movement_count
  FROM stock_movements sm
  LEFT JOIN products p ON p.id = sm.product_id
  WHERE sm.movement_type = 'sale'
    AND sm.product_id IS NOT NULL
  GROUP BY (sm.created_at AT TIME ZONE 'Asia/Karachi')::DATE, sm.product_id, p.name, p.sku
),
product_summaries AS (
  SELECT 
    summary_date,
    jsonb_object_agg(
      product_id::TEXT, 
      jsonb_build_object(
        'name', COALESCE(product_name, 'Unknown Product'),
        'sku', COALESCE(product_sku, ''),
        'total_qty', total_qty
      )
    ) as product_items,
    SUM(total_qty)::INTEGER as total_product_units,
    COUNT(DISTINCT product_id)::INTEGER as unique_products,
    SUM(movement_count)::INTEGER as order_count
  FROM product_daily_totals
  GROUP BY summary_date
),
-- Step 3: Correctly aggregate historical packaging dispatch data
packaging_daily_totals AS (
  SELECT 
    (pm.created_at AT TIME ZONE 'Asia/Karachi')::DATE as summary_date,
    pm.packaging_item_id,
    pi.name as packaging_name,
    pi.sku as packaging_sku,
    SUM(ABS(pm.quantity)) as total_qty
  FROM packaging_movements pm
  LEFT JOIN packaging_items pi ON pi.id = pm.packaging_item_id
  WHERE pm.movement_type = 'dispatch'
    AND pm.packaging_item_id IS NOT NULL
  GROUP BY (pm.created_at AT TIME ZONE 'Asia/Karachi')::DATE, pm.packaging_item_id, pi.name, pi.sku
),
packaging_summaries AS (
  SELECT 
    summary_date,
    jsonb_object_agg(
      packaging_item_id::TEXT, 
      jsonb_build_object(
        'name', COALESCE(packaging_name, 'Unknown Packaging'),
        'sku', COALESCE(packaging_sku, ''),
        'total_qty', total_qty
      )
    ) as packaging_items,
    SUM(total_qty)::INTEGER as total_packaging_units,
    COUNT(DISTINCT packaging_item_id)::INTEGER as unique_packaging
  FROM packaging_daily_totals
  GROUP BY summary_date
)
-- Step 4: Insert correctly aggregated data
INSERT INTO daily_dispatch_summaries (
  summary_date,
  product_items,
  total_product_units,
  unique_products,
  packaging_items,
  total_packaging_units,
  unique_packaging,
  order_count,
  created_at,
  updated_at
)
SELECT 
  COALESCE(ps.summary_date, pkg.summary_date) as summary_date,
  COALESCE(ps.product_items, '{}'::JSONB) as product_items,
  COALESCE(ps.total_product_units, 0) as total_product_units,
  COALESCE(ps.unique_products, 0) as unique_products,
  COALESCE(pkg.packaging_items, '{}'::JSONB) as packaging_items,
  COALESCE(pkg.total_packaging_units, 0) as total_packaging_units,
  COALESCE(pkg.unique_packaging, 0) as unique_packaging,
  COALESCE(ps.order_count, 0) as order_count,
  NOW() as created_at,
  NOW() as updated_at
FROM product_summaries ps
FULL OUTER JOIN packaging_summaries pkg ON ps.summary_date = pkg.summary_date;