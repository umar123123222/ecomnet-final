-- Add allocation_type and linked_product_ids columns to packaging_items
ALTER TABLE public.packaging_items 
ADD COLUMN IF NOT EXISTS allocation_type text DEFAULT 'none' CHECK (allocation_type IN ('per_product', 'product_specific', 'per_order_rules', 'none')),
ADD COLUMN IF NOT EXISTS linked_product_ids uuid[] DEFAULT '{}';

-- Add index for linked_product_ids lookup
CREATE INDEX IF NOT EXISTS idx_packaging_items_allocation_type ON public.packaging_items(allocation_type);

-- Migrate existing packaging items with known allocation types
-- Corrugated box, Shopping bag, Gift box -> per_product
UPDATE public.packaging_items 
SET allocation_type = 'per_product'
WHERE id IN (
  'f3291e35-4271-436c-81c7-2e3eb0cb4d9a', -- Corrugated box
  '12598db4-2b80-43c6-9a24-176712a8c463', -- Shopping bag
  '5c8035b5-eaf6-46f3-9014-db5bcd59da63'  -- Gift box
);

-- Tester Box -> product_specific with linked tester product
UPDATE public.packaging_items 
SET allocation_type = 'product_specific',
    linked_product_ids = ARRAY['3b2a0ff7-3a21-4fcd-a03f-d305afde5eed']::uuid[]
WHERE id = '3b059acf-9519-43df-bdf0-a4f6125db079';

-- Flyers -> per_order_rules (they are managed via order_packaging_rules table)
UPDATE public.packaging_items 
SET allocation_type = 'per_order_rules'
WHERE LOWER(name) LIKE '%flyer%';

-- Update get_packaging_reservations function to use dynamic allocation types
CREATE OR REPLACE FUNCTION public.get_packaging_reservations()
RETURNS TABLE(packaging_item_id uuid, reserved_count bigint)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
  WITH pending_orders AS (
    SELECT id FROM orders WHERE status IN ('pending', 'booked')
  ),
  -- Get all order items for pending orders
  pending_order_items AS (
    SELECT oi.order_id, oi.product_id, oi.quantity
    FROM order_items oi
    JOIN pending_orders po ON po.id = oi.order_id
  ),
  -- Calculate total items per order (for per_order_rules)
  order_item_counts AS (
    SELECT poi.order_id, SUM(poi.quantity)::int as total_items
    FROM pending_order_items poi
    GROUP BY poi.order_id
  ),
  -- Get linked product IDs for product_specific packaging
  product_specific_packaging AS (
    SELECT pi.id as pkg_id, unnest(pi.linked_product_ids) as product_id
    FROM packaging_items pi
    WHERE pi.allocation_type = 'product_specific'
      AND pi.is_active = true
      AND array_length(pi.linked_product_ids, 1) > 0
  ),
  -- Calculate per_product packaging (one per perfume product, excluding product_specific products)
  per_product_reservations AS (
    SELECT 
      pi.id as pkg_id,
      COALESCE(SUM(poi.quantity), 0)::bigint as cnt
    FROM packaging_items pi
    CROSS JOIN pending_order_items poi
    WHERE pi.allocation_type = 'per_product'
      AND pi.is_active = true
      -- Exclude products that have product-specific packaging
      AND NOT EXISTS (
        SELECT 1 FROM product_specific_packaging psp 
        WHERE psp.product_id = poi.product_id
      )
    GROUP BY pi.id
  ),
  -- Calculate product_specific packaging (for specific products only)
  product_specific_reservations AS (
    SELECT 
      psp.pkg_id,
      COALESCE(SUM(poi.quantity), 0)::bigint as cnt
    FROM product_specific_packaging psp
    JOIN pending_order_items poi ON poi.product_id = psp.product_id
    GROUP BY psp.pkg_id
  ),
  -- Calculate per_order_rules packaging (flyers via rules)
  matched_rules AS (
    SELECT DISTINCT ON (oic.order_id) 
      oic.order_id, 
      opr.packaging_item_id as pkg_id
    FROM order_item_counts oic
    JOIN order_packaging_rules opr ON 
      oic.total_items >= opr.min_items 
      AND oic.total_items <= opr.max_items
      AND opr.is_active = true
    JOIN packaging_items pi ON pi.id = opr.packaging_item_id
    WHERE pi.allocation_type = 'per_order_rules'
      AND pi.is_active = true
    ORDER BY oic.order_id, opr.priority DESC, opr.min_items ASC
  ),
  per_order_reservations AS (
    SELECT mr.pkg_id, COUNT(*)::bigint as cnt
    FROM matched_rules mr
    GROUP BY mr.pkg_id
  ),
  -- Combine all reservations
  all_reservations AS (
    SELECT pkg_id, cnt FROM per_product_reservations WHERE cnt > 0
    UNION ALL
    SELECT pkg_id, cnt FROM product_specific_reservations WHERE cnt > 0
    UNION ALL
    SELECT pkg_id, cnt FROM per_order_reservations WHERE cnt > 0
  )
  SELECT ar.pkg_id as packaging_item_id, ar.cnt as reserved_count
  FROM all_reservations ar;
END;
$$;

COMMENT ON COLUMN public.packaging_items.allocation_type IS 'How packaging is allocated: per_product (one per product unit), product_specific (only for linked products), per_order_rules (via order_packaging_rules), none (manual only)';