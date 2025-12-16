-- Create daily_dispatch_summaries table for real-time aggregation
CREATE TABLE public.daily_dispatch_summaries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  summary_date DATE NOT NULL UNIQUE,
  product_items JSONB DEFAULT '{}'::jsonb,
  packaging_items JSONB DEFAULT '{}'::jsonb,
  total_product_units INTEGER DEFAULT 0,
  total_packaging_units INTEGER DEFAULT 0,
  unique_products INTEGER DEFAULT 0,
  unique_packaging INTEGER DEFAULT 0,
  order_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.daily_dispatch_summaries ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Authorized users can view dispatch summaries"
ON public.daily_dispatch_summaries FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = auth.uid()
    AND role IN ('super_admin', 'super_manager', 'warehouse_manager', 'finance')
    AND is_active = true
  )
);

-- Index for fast date lookups
CREATE INDEX idx_daily_dispatch_summaries_date ON public.daily_dispatch_summaries(summary_date DESC);

-- Trigger function for product dispatches (stock_movements with type 'sale')
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
  v_existing_items JSONB;
  v_product_key TEXT;
  v_current_qty INTEGER;
  v_abs_qty INTEGER;
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
  
  -- Use product_id as key
  v_product_key := NEW.product_id::TEXT;
  
  -- Absolute quantity (dispatches are negative, we want positive for display)
  v_abs_qty := ABS(NEW.quantity);

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
      'total_qty', v_abs_qty
    )),
    v_abs_qty,
    1,
    1,
    NOW()
  )
  ON CONFLICT (summary_date) DO UPDATE SET
    product_items = CASE
      WHEN daily_dispatch_summaries.product_items ? v_product_key THEN
        jsonb_set(
          daily_dispatch_summaries.product_items,
          ARRAY[v_product_key, 'total_qty'],
          to_jsonb(
            COALESCE((daily_dispatch_summaries.product_items -> v_product_key ->> 'total_qty')::INTEGER, 0) + v_abs_qty
          )
        )
      ELSE
        daily_dispatch_summaries.product_items || jsonb_build_object(v_product_key, jsonb_build_object(
          'name', COALESCE(v_product_name, 'Unknown Product'),
          'sku', COALESCE(v_product_sku, ''),
          'total_qty', v_abs_qty
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
    order_count = daily_dispatch_summaries.order_count + 1,
    updated_at = NOW();

  RETURN NEW;
END;
$$;

-- Trigger function for packaging dispatches
CREATE OR REPLACE FUNCTION public.aggregate_packaging_dispatch()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_today DATE;
  v_packaging_name TEXT;
  v_packaging_sku TEXT;
  v_existing_items JSONB;
  v_packaging_key TEXT;
  v_abs_qty INTEGER;
BEGIN
  -- Only process 'dispatch' type movements
  IF NEW.movement_type != 'dispatch' THEN
    RETURN NEW;
  END IF;

  -- Get today's date in Pakistan timezone
  v_today := (NOW() AT TIME ZONE 'Asia/Karachi')::DATE;
  
  -- Get packaging details
  SELECT name, sku INTO v_packaging_name, v_packaging_sku
  FROM packaging_items WHERE id = NEW.packaging_item_id;
  
  -- Use packaging_item_id as key
  v_packaging_key := NEW.packaging_item_id::TEXT;
  
  -- Absolute quantity (dispatches are negative, we want positive for display)
  v_abs_qty := ABS(NEW.quantity);

  -- UPSERT into daily_dispatch_summaries
  INSERT INTO daily_dispatch_summaries (
    summary_date,
    packaging_items,
    total_packaging_units,
    unique_packaging,
    updated_at
  ) VALUES (
    v_today,
    jsonb_build_object(v_packaging_key, jsonb_build_object(
      'name', COALESCE(v_packaging_name, 'Unknown Packaging'),
      'sku', COALESCE(v_packaging_sku, ''),
      'total_qty', v_abs_qty
    )),
    v_abs_qty,
    1,
    NOW()
  )
  ON CONFLICT (summary_date) DO UPDATE SET
    packaging_items = CASE
      WHEN daily_dispatch_summaries.packaging_items ? v_packaging_key THEN
        jsonb_set(
          daily_dispatch_summaries.packaging_items,
          ARRAY[v_packaging_key, 'total_qty'],
          to_jsonb(
            COALESCE((daily_dispatch_summaries.packaging_items -> v_packaging_key ->> 'total_qty')::INTEGER, 0) + v_abs_qty
          )
        )
      ELSE
        daily_dispatch_summaries.packaging_items || jsonb_build_object(v_packaging_key, jsonb_build_object(
          'name', COALESCE(v_packaging_name, 'Unknown Packaging'),
          'sku', COALESCE(v_packaging_sku, ''),
          'total_qty', v_abs_qty
        ))
    END,
    total_packaging_units = daily_dispatch_summaries.total_packaging_units + v_abs_qty,
    unique_packaging = (
      SELECT COUNT(*)::INTEGER FROM jsonb_object_keys(
        CASE
          WHEN daily_dispatch_summaries.packaging_items ? v_packaging_key THEN daily_dispatch_summaries.packaging_items
          ELSE daily_dispatch_summaries.packaging_items || jsonb_build_object(v_packaging_key, '{}'::jsonb)
        END
      )
    ),
    updated_at = NOW();

  RETURN NEW;
END;
$$;

-- Create triggers
CREATE TRIGGER trg_aggregate_product_dispatch
AFTER INSERT ON stock_movements
FOR EACH ROW
EXECUTE FUNCTION aggregate_product_dispatch();

CREATE TRIGGER trg_aggregate_packaging_dispatch
AFTER INSERT ON packaging_movements
FOR EACH ROW
EXECUTE FUNCTION aggregate_packaging_dispatch();

-- One-time migration: Aggregate existing historical dispatch records
INSERT INTO daily_dispatch_summaries (summary_date, product_items, total_product_units, unique_products, order_count)
SELECT 
  (sm.created_at AT TIME ZONE 'Asia/Karachi')::DATE as summary_date,
  jsonb_object_agg(
    p.id::TEXT,
    jsonb_build_object(
      'name', p.name,
      'sku', COALESCE(p.sku, ''),
      'total_qty', agg.total_qty
    )
  ) as product_items,
  SUM(agg.total_qty)::INTEGER as total_product_units,
  COUNT(DISTINCT p.id)::INTEGER as unique_products,
  SUM(agg.movement_count)::INTEGER as order_count
FROM (
  SELECT 
    product_id,
    (created_at AT TIME ZONE 'Asia/Karachi')::DATE as dispatch_date,
    ABS(SUM(quantity))::INTEGER as total_qty,
    COUNT(*)::INTEGER as movement_count
  FROM stock_movements
  WHERE movement_type = 'sale'
  GROUP BY product_id, (created_at AT TIME ZONE 'Asia/Karachi')::DATE
) agg
JOIN stock_movements sm ON sm.product_id = agg.product_id 
  AND (sm.created_at AT TIME ZONE 'Asia/Karachi')::DATE = agg.dispatch_date
  AND sm.movement_type = 'sale'
JOIN products p ON p.id = agg.product_id
GROUP BY (sm.created_at AT TIME ZONE 'Asia/Karachi')::DATE
ON CONFLICT (summary_date) DO UPDATE SET
  product_items = EXCLUDED.product_items,
  total_product_units = EXCLUDED.total_product_units,
  unique_products = EXCLUDED.unique_products,
  order_count = EXCLUDED.order_count,
  updated_at = NOW();

-- Migrate packaging movements
WITH packaging_agg AS (
  SELECT 
    (pm.created_at AT TIME ZONE 'Asia/Karachi')::DATE as summary_date,
    jsonb_object_agg(
      pi.id::TEXT,
      jsonb_build_object(
        'name', pi.name,
        'sku', COALESCE(pi.sku, ''),
        'total_qty', agg.total_qty
      )
    ) as packaging_items,
    SUM(agg.total_qty)::INTEGER as total_packaging_units,
    COUNT(DISTINCT pi.id)::INTEGER as unique_packaging
  FROM (
    SELECT 
      packaging_item_id,
      (created_at AT TIME ZONE 'Asia/Karachi')::DATE as dispatch_date,
      ABS(SUM(quantity))::INTEGER as total_qty
    FROM packaging_movements
    WHERE movement_type = 'dispatch'
    GROUP BY packaging_item_id, (created_at AT TIME ZONE 'Asia/Karachi')::DATE
  ) agg
  JOIN packaging_movements pm ON pm.packaging_item_id = agg.packaging_item_id 
    AND (pm.created_at AT TIME ZONE 'Asia/Karachi')::DATE = agg.dispatch_date
    AND pm.movement_type = 'dispatch'
  JOIN packaging_items pi ON pi.id = agg.packaging_item_id
  GROUP BY (pm.created_at AT TIME ZONE 'Asia/Karachi')::DATE
)
UPDATE daily_dispatch_summaries dds
SET 
  packaging_items = pa.packaging_items,
  total_packaging_units = pa.total_packaging_units,
  unique_packaging = pa.unique_packaging,
  updated_at = NOW()
FROM packaging_agg pa
WHERE dds.summary_date = pa.summary_date;