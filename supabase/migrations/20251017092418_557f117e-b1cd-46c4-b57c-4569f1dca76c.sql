-- Add packaging_item_id column to grn_items table to support receiving packaging materials
ALTER TABLE grn_items 
ADD COLUMN packaging_item_id uuid REFERENCES packaging_items(id);

-- Add check constraint to ensure either product_id or packaging_item_id is set in grn_items
ALTER TABLE grn_items
ADD CONSTRAINT grn_product_or_packaging_required 
CHECK (
  (product_id IS NOT NULL AND packaging_item_id IS NULL) OR
  (product_id IS NULL AND packaging_item_id IS NOT NULL)
);