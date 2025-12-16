-- Add tags and notes columns to customers table
ALTER TABLE public.customers 
ADD COLUMN IF NOT EXISTS tags JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS notes JSONB DEFAULT '[]'::jsonb;

-- Add comment for clarity
COMMENT ON COLUMN public.customers.tags IS 'Array of tag objects: {id, text, addedBy, addedAt}';
COMMENT ON COLUMN public.customers.notes IS 'Array of note objects: {id, text, addedBy, addedAt}';