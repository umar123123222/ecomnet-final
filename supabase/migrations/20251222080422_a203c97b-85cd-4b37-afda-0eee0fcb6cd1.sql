-- Add bundle tracking columns to order_items
ALTER TABLE public.order_items 
ADD COLUMN IF NOT EXISTS bundle_product_id UUID REFERENCES public.products(id),
ADD COLUMN IF NOT EXISTS is_bundle_component BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS bundle_name TEXT;

-- Create index for bundle grouping queries
CREATE INDEX IF NOT EXISTS idx_order_items_bundle_product_id ON public.order_items(bundle_product_id) WHERE bundle_product_id IS NOT NULL;

-- Add comment for clarity
COMMENT ON COLUMN public.order_items.bundle_product_id IS 'References the parent bundle product if this item was ordered as part of a bundle';
COMMENT ON COLUMN public.order_items.is_bundle_component IS 'True if this item was ordered as part of a bundle';
COMMENT ON COLUMN public.order_items.bundle_name IS 'Cached name of the bundle for display purposes';