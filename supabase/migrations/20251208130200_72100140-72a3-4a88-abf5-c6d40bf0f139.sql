-- Reset ALL bundle product inventories to 0 (bundles should have virtual inventory only)
-- Bundle availability is calculated from component products, not stored directly

UPDATE inventory 
SET quantity = 0, reserved_quantity = 0
WHERE product_id IN (
  SELECT id FROM products WHERE is_bundle = true
);

-- Also ensure any products with "Bundle" in name are marked as bundles
UPDATE products 
SET is_bundle = true 
WHERE (name ILIKE '%bundle%' OR name ILIKE '%combo%' OR name ILIKE '%pack%')
  AND is_bundle = false;

-- Reset inventory for newly identified bundles too
UPDATE inventory 
SET quantity = 0, reserved_quantity = 0
WHERE product_id IN (
  SELECT id FROM products 
  WHERE is_bundle = true 
    AND id IN (SELECT product_id FROM inventory WHERE quantity != 0 OR reserved_quantity != 0)
);