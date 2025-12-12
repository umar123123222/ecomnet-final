-- Make product_id nullable in grn_items table to support packaging-only items
ALTER TABLE public.grn_items ALTER COLUMN product_id DROP NOT NULL;

-- Add a check constraint to ensure either product_id or packaging_item_id is provided
ALTER TABLE public.grn_items ADD CONSTRAINT grn_items_product_or_packaging_check 
CHECK (product_id IS NOT NULL OR packaging_item_id IS NOT NULL);