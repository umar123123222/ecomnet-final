
-- Fix order_count to count unique orders instead of stock movement records
-- Also add order-level breakdown to product_items JSONB structure

-- Enhanced trigger function for product dispatches with correct order counting and order breakdown
CREATE OR REPLACE FUNCTION public.aggregate_product_dispatch()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_today DATE;
  v_product_name TEXT;
  v_product_sku TEXT;
  v_product_key TEXT;
  v_abs_qty INTEGER;
  v_order_id TEXT;
  v_order_number TEXT;
  v_existing_orders JSONB;
  v_existing_product JSONB;
  v_new_order_entry JSONB;
  v_is_new_order BOOLEAN;
BEGIN
  -- Only process 'sale' type movements (dispatches)
  IF NEW.movement_type != 'sale' THEN
    RETURN NEW;
  END IF;

  -- Get today's date in Pakistan timezone
  v_today := (NOW() AT TIME ZONE 'Asia/Karachi')::DATE;
  
  -- Get product details
  SELECT name, sku INTO v_product_name, v_product_sku
  FROM products WHERE id = NEW.product_id;
  
  -- Get order details if reference_id exists
  v_order_id := NEW.reference_id::TEXT;
  IF NEW.reference_id IS NOT NULL THEN
    SELECT order_number INTO v_order_number
    FROM orders WHERE id = NEW.reference_id;
  END IF;
  
  -- Use product_id as key
  v_product_key := NEW.product_id::TEXT;
  
  -- Absolute quantity (dispatches are negative, we want positive for display)
  v_abs_qty := ABS(NEW.quantity);
  
  -- Build order entry
  v_new_order_entry := jsonb_build_object(
    'order_id', COALESCE(v_order_id, 'unknown'),
    'order_number', COALESCE(v_order_number, 'Unknown'),
    'qty', v_abs_qty
  );

  -- Check if this order_id is already tracked for today (for order_count)
  SELECT EXISTS(
    SELECT 1 FROM daily_dispatch_summaries dds
    WHERE dds.summary_date = v_today
    AND (
      -- Check in product_items orders arrays
      EXISTS (
        SELECT 1 FROM jsonb_each(dds.product_items) item
        WHERE EXISTS (
          SELECT 1 FROM jsonb_array_elements(COALESCE(item.value->'orders', '[]'::jsonb)) o
          WHERE o->>'order_id' = v_order_id
        )
      )
    )
  ) INTO v_is_new_order;
  
  -- v_is_new_order is TRUE if order EXISTS, so we negate it
  v_is_new_order := NOT v_is_new_order;

  -- UPSERT into daily_dispatch_summaries
  INSERT INTO daily_dispatch_summaries (
    summary_date,
    product_items,
    total_product_units,
    unique_products,
    order_count,
    updated_at
  ) VALUES (
    v_today,
    jsonb_build_object(v_product_key, jsonb_build_object(
      'name', COALESCE(v_product_name, 'Unknown Product'),
      'sku', COALESCE(v_product_sku, ''),
      'total_qty', v_abs_qty,
      'orders', jsonb_build_array(v_new_order_entry)
    )),
    v_abs_qty,
    1,
    1,
    NOW()
  )
  ON CONFLICT (summary_date) DO UPDATE SET
    product_items = CASE
      WHEN daily_dispatch_summaries.product_items ? v_product_key THEN
        -- Product exists, update its total_qty and orders array
        jsonb_set(
          jsonb_set(
            daily_dispatch_summaries.product_items,
            ARRAY[v_product_key, 'total_qty'],
            to_jsonb(
              COALESCE((daily_dispatch_summaries.product_items -> v_product_key ->> 'total_qty')::INTEGER, 0) + v_abs_qty
            )
          ),
          ARRAY[v_product_key, 'orders'],
          COALESCE(daily_dispatch_summaries.product_items -> v_product_key -> 'orders', '[]'::jsonb) || jsonb_build_array(v_new_order_entry)
        )
      ELSE
        -- New product, add it with orders array
        daily_dispatch_summaries.product_items || jsonb_build_object(v_product_key, jsonb_build_object(
          'name', COALESCE(v_product_name, 'Unknown Product'),
          'sku', COALESCE(v_product_sku, ''),
          'total_qty', v_abs_qty,
          'orders', jsonb_build_array(v_new_order_entry)
        ))
    END,
    total_product_units = daily_dispatch_summaries.total_product_units + v_abs_qty,
    unique_products = (
      SELECT COUNT(*)::INTEGER FROM jsonb_object_keys(
        CASE
          WHEN daily_dispatch_summaries.product_items ? v_product_key THEN daily_dispatch_summaries.product_items
          ELSE daily_dispatch_summaries.product_items || jsonb_build_object(v_product_key, '{}'::jsonb)
        END
      )
    ),
    -- Only increment order_count if this is a new unique order for today
    order_count = daily_dispatch_summaries.order_count + CASE WHEN v_is_new_order AND v_order_id IS NOT NULL THEN 1 ELSE 0 END,
    updated_at = NOW();

  RETURN NEW;
END;
$$;

-- Now backfill all historical data with correct order counts and order breakdown
TRUNCATE TABLE daily_dispatch_summaries;

-- Rebuild with correct aggregation including order breakdown
WITH product_order_details AS (
  -- Get all product dispatches with order info
  SELECT 
    (sm.created_at AT TIME ZONE 'Asia/Karachi')::DATE as summary_date,
    sm.product_id,
    p.name as product_name,
    COALESCE(p.sku, '') as product_sku,
    sm.reference_id as order_id,
    COALESCE(o.order_number, 'Unknown') as order_number,
    ABS(sm.quantity) as qty
  FROM stock_movements sm
  JOIN products p ON p.id = sm.product_id
  LEFT JOIN orders o ON o.id = sm.reference_id
  WHERE sm.movement_type = 'sale'
),
product_aggregated AS (
  -- Aggregate orders per product per day
  SELECT 
    summary_date,
    product_id,
    product_name,
    product_sku,
    SUM(qty) as total_qty,
    jsonb_agg(
      jsonb_build_object(
        'order_id', COALESCE(order_id::TEXT, 'unknown'),
        'order_number', order_number,
        'qty', qty
      )
    ) as orders
  FROM product_order_details
  GROUP BY summary_date, product_id, product_name, product_sku
),
daily_products AS (
  -- Build product_items JSONB per day
  SELECT 
    summary_date,
    jsonb_object_agg(
      product_id::TEXT,
      jsonb_build_object(
        'name', product_name,
        'sku', product_sku,
        'total_qty', total_qty,
        'orders', orders
      )
    ) as product_items,
    SUM(total_qty)::INTEGER as total_product_units,
    COUNT(DISTINCT product_id)::INTEGER as unique_products
  FROM product_aggregated
  GROUP BY summary_date
),
daily_order_counts AS (
  -- Count unique orders per day
  SELECT 
    (sm.created_at AT TIME ZONE 'Asia/Karachi')::DATE as summary_date,
    COUNT(DISTINCT sm.reference_id)::INTEGER as order_count
  FROM stock_movements sm
  WHERE sm.movement_type = 'sale'
    AND sm.reference_id IS NOT NULL
  GROUP BY (sm.created_at AT TIME ZONE 'Asia/Karachi')::DATE
)
INSERT INTO daily_dispatch_summaries (
  summary_date,
  product_items,
  total_product_units,
  unique_products,
  order_count,
  created_at,
  updated_at
)
SELECT 
  dp.summary_date,
  dp.product_items,
  dp.total_product_units,
  dp.unique_products,
  COALESCE(doc.order_count, 0),
  NOW(),
  NOW()
FROM daily_products dp
LEFT JOIN daily_order_counts doc ON doc.summary_date = dp.summary_date;

-- Now add packaging data
WITH packaging_order_details AS (
  SELECT 
    (pm.created_at AT TIME ZONE 'Asia/Karachi')::DATE as summary_date,
    pm.packaging_item_id,
    pi.name as packaging_name,
    COALESCE(pi.sku, '') as packaging_sku,
    pm.reference_id as order_id,
    COALESCE(o.order_number, 'Unknown') as order_number,
    ABS(pm.quantity) as qty
  FROM packaging_movements pm
  JOIN packaging_items pi ON pi.id = pm.packaging_item_id
  LEFT JOIN orders o ON o.id = pm.reference_id
  WHERE pm.movement_type = 'dispatch'
),
packaging_aggregated AS (
  SELECT 
    summary_date,
    packaging_item_id,
    packaging_name,
    packaging_sku,
    SUM(qty) as total_qty,
    jsonb_agg(
      jsonb_build_object(
        'order_id', COALESCE(order_id::TEXT, 'unknown'),
        'order_number', order_number,
        'qty', qty
      )
    ) as orders
  FROM packaging_order_details
  GROUP BY summary_date, packaging_item_id, packaging_name, packaging_sku
),
daily_packaging AS (
  SELECT 
    summary_date,
    jsonb_object_agg(
      packaging_item_id::TEXT,
      jsonb_build_object(
        'name', packaging_name,
        'sku', packaging_sku,
        'total_qty', total_qty,
        'orders', orders
      )
    ) as packaging_items,
    SUM(total_qty)::INTEGER as total_packaging_units,
    COUNT(DISTINCT packaging_item_id)::INTEGER as unique_packaging
  FROM packaging_aggregated
  GROUP BY summary_date
)
UPDATE daily_dispatch_summaries dds
SET 
  packaging_items = dpkg.packaging_items,
  total_packaging_units = dpkg.total_packaging_units,
  unique_packaging = dpkg.unique_packaging,
  updated_at = NOW()
FROM daily_packaging dpkg
WHERE dds.summary_date = dpkg.summary_date;

-- Insert any packaging-only days that don't have product data
WITH packaging_order_details AS (
  SELECT 
    (pm.created_at AT TIME ZONE 'Asia/Karachi')::DATE as summary_date,
    pm.packaging_item_id,
    pi.name as packaging_name,
    COALESCE(pi.sku, '') as packaging_sku,
    pm.reference_id as order_id,
    COALESCE(o.order_number, 'Unknown') as order_number,
    ABS(pm.quantity) as qty
  FROM packaging_movements pm
  JOIN packaging_items pi ON pi.id = pm.packaging_item_id
  LEFT JOIN orders o ON o.id = pm.reference_id
  WHERE pm.movement_type = 'dispatch'
),
packaging_aggregated AS (
  SELECT 
    summary_date,
    packaging_item_id,
    packaging_name,
    packaging_sku,
    SUM(qty) as total_qty,
    jsonb_agg(
      jsonb_build_object(
        'order_id', COALESCE(order_id::TEXT, 'unknown'),
        'order_number', order_number,
        'qty', qty
      )
    ) as orders
  FROM packaging_order_details
  GROUP BY summary_date, packaging_item_id, packaging_name, packaging_sku
),
daily_packaging AS (
  SELECT 
    summary_date,
    jsonb_object_agg(
      packaging_item_id::TEXT,
      jsonb_build_object(
        'name', packaging_name,
        'sku', packaging_sku,
        'total_qty', total_qty,
        'orders', orders
      )
    ) as packaging_items,
    SUM(total_qty)::INTEGER as total_packaging_units,
    COUNT(DISTINCT packaging_item_id)::INTEGER as unique_packaging
  FROM packaging_aggregated
  GROUP BY summary_date
)
INSERT INTO daily_dispatch_summaries (
  summary_date,
  packaging_items,
  total_packaging_units,
  unique_packaging,
  created_at,
  updated_at
)
SELECT 
  dpkg.summary_date,
  dpkg.packaging_items,
  dpkg.total_packaging_units,
  dpkg.unique_packaging,
  NOW(),
  NOW()
FROM daily_packaging dpkg
WHERE NOT EXISTS (
  SELECT 1 FROM daily_dispatch_summaries dds
  WHERE dds.summary_date = dpkg.summary_date
);
