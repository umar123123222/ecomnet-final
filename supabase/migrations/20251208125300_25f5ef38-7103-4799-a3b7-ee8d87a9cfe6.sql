-- Reset the 3x Perfume Bundle inventory to 0 (was corrupted by Shopify placeholder value)
UPDATE inventory 
SET quantity = 0, reserved_quantity = 0
WHERE id = '75d0e20c-d04a-4d29-870d-b75be0d38fee';

-- Also mark the product as a bundle since it clearly is one
UPDATE products 
SET is_bundle = true 
WHERE id = '9f5db6b3-6270-4829-aacc-434338734a69';