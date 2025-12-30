
-- Clean up existing bundle products from daily_dispatch_summaries
-- Use a simpler approach with a helper function

CREATE OR REPLACE FUNCTION public.cleanup_bundles_from_summaries()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_summary RECORD;
  v_new_product_items JSONB;
  v_removed_qty INTEGER;
  v_removed_count INTEGER;
  v_item RECORD;
BEGIN
  -- For each summary, remove bundle products
  FOR v_summary IN SELECT * FROM daily_dispatch_summaries LOOP
    v_new_product_items := '{}'::JSONB;
    v_removed_qty := 0;
    v_removed_count := 0;
    
    -- Iterate through product_items
    FOR v_item IN SELECT key, value FROM jsonb_each(v_summary.product_items) LOOP
      -- Check if this product is a bundle
      IF EXISTS (SELECT 1 FROM products WHERE id = v_item.key::UUID AND is_bundle = true) THEN
        -- This is a bundle, skip it
        v_removed_qty := v_removed_qty + COALESCE((v_item.value->>'total_qty')::INTEGER, 0);
        v_removed_count := v_removed_count + 1;
      ELSE
        -- Not a bundle, keep it
        v_new_product_items := v_new_product_items || jsonb_build_object(v_item.key, v_item.value);
      END IF;
    END LOOP;
    
    -- Update the summary if any bundles were removed
    IF v_removed_count > 0 THEN
      UPDATE daily_dispatch_summaries 
      SET 
        product_items = v_new_product_items,
        total_product_units = GREATEST(0, total_product_units - v_removed_qty),
        unique_products = GREATEST(0, unique_products - v_removed_count),
        updated_at = NOW()
      WHERE id = v_summary.id;
    END IF;
  END LOOP;
END;
$function$;

-- Execute the cleanup
SELECT cleanup_bundles_from_summaries();

-- Drop the helper function after use
DROP FUNCTION IF EXISTS cleanup_bundles_from_summaries();
