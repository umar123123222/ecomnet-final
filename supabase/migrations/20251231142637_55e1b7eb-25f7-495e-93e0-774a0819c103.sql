-- Phase 1: Database and Storage Setup for Bulk Label Printing

-- 1. Create storage bucket for courier labels
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'courier-labels', 
  'courier-labels', 
  true, 
  5242880, -- 5MB limit
  ARRAY['application/pdf', 'image/png']::text[]
)
ON CONFLICT (id) DO NOTHING;

-- 2. Add label caching columns to dispatches table
ALTER TABLE public.dispatches 
ADD COLUMN IF NOT EXISTS label_storage_path text,
ADD COLUMN IF NOT EXISTS label_cached_at timestamptz,
ADD COLUMN IF NOT EXISTS label_expires_at timestamptz;

-- 3. Add bulk print columns to courier_awbs table
ALTER TABLE public.courier_awbs
ADD COLUMN IF NOT EXISTS storage_path text,
ADD COLUMN IF NOT EXISTS expires_at timestamptz,
ADD COLUMN IF NOT EXISTS labels_per_page integer DEFAULT 3;

-- 4. Add print_config to couriers table
ALTER TABLE public.couriers
ADD COLUMN IF NOT EXISTS print_config jsonb DEFAULT '{}'::jsonb;

-- 5. Create index for cleanup queries
CREATE INDEX IF NOT EXISTS idx_dispatches_label_expires_at 
ON public.dispatches (label_expires_at) 
WHERE label_expires_at IS NOT NULL;

-- 6. Storage policies for courier-labels bucket
CREATE POLICY "Allow authenticated users to read labels"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'courier-labels');

CREATE POLICY "Allow authenticated users to upload labels"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'courier-labels');

CREATE POLICY "Allow authenticated users to delete labels"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'courier-labels');

-- 7. Update courier print_config with courier-specific settings
UPDATE public.couriers
SET print_config = jsonb_build_object(
  'print_type', 4,
  'supports_bulk_print', true,
  'native_3_per_page', true
)
WHERE LOWER(code) = 'tcs';

UPDATE public.couriers
SET print_config = jsonb_build_object(
  'max_tracking_per_request', 10,
  'supports_bulk_print', true,
  'native_3_per_page', false,
  'rate_limit_delay_ms', 500
)
WHERE LOWER(code) = 'postex';

UPDATE public.couriers
SET print_config = jsonb_build_object(
  'supports_bulk_print', false,
  'native_3_per_page', false,
  'requires_individual_fetch', true
)
WHERE LOWER(code) = 'leopard';

-- 8. Add retention settings to api_settings
INSERT INTO public.api_settings (setting_key, setting_value, description)
VALUES 
  ('LABEL_RETENTION_DAYS', '120', 'Number of days to retain courier labels in storage'),
  ('BULK_PRINT_RETENTION_DAYS', '7', 'Number of days to retain bulk print PDFs')
ON CONFLICT (setting_key) DO NOTHING;