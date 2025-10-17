-- Add supplier_id column to products table
ALTER TABLE products ADD COLUMN IF NOT EXISTS supplier_id UUID REFERENCES suppliers(id);

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_products_supplier ON products(supplier_id);