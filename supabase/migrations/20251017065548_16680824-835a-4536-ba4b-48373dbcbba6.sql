-- Add packaging_item_id column to purchase_order_items table
ALTER TABLE purchase_order_items 
ADD COLUMN packaging_item_id uuid REFERENCES packaging_items(id);

-- Make product_id nullable since items can be either products or packaging
ALTER TABLE purchase_order_items 
ALTER COLUMN product_id DROP NOT NULL;

-- Add check constraint to ensure either product_id or packaging_item_id is set
ALTER TABLE purchase_order_items
ADD CONSTRAINT product_or_packaging_required 
CHECK (
  (product_id IS NOT NULL AND packaging_item_id IS NULL) OR
  (product_id IS NULL AND packaging_item_id IS NOT NULL)
);