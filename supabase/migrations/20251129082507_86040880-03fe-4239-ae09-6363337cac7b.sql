-- Make SKU optional in products and product_variants tables
ALTER TABLE products ALTER COLUMN sku DROP NOT NULL;
ALTER TABLE product_variants ALTER COLUMN sku DROP NOT NULL;

-- Update unique constraint on products SKU to allow nulls
ALTER TABLE products DROP CONSTRAINT IF EXISTS products_sku_key;
CREATE UNIQUE INDEX products_sku_key ON products(sku) WHERE sku IS NOT NULL;

-- Update unique constraint on product_variants SKU to allow nulls
ALTER TABLE product_variants DROP CONSTRAINT IF EXISTS product_variants_sku_key;
CREATE UNIQUE INDEX product_variants_sku_key ON product_variants(sku) WHERE sku IS NOT NULL;