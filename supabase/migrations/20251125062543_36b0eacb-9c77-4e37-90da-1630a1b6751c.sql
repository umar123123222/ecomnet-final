-- Step 1: Fix invalid endpoint URLs in existing data
UPDATE public.couriers
SET 
  api_endpoint = 'https://api.tcs.com.pk',
  booking_endpoint = 'https://api.tcs.com.pk/api/v1/shipments',
  tracking_endpoint = 'https://api.tcs.com.pk/api/v1/tracking',
  label_endpoint = 'https://api.tcs.com.pk/api/v1/labels'
WHERE code = 'tcs' AND (
  api_endpoint = 'mock' OR 
  booking_endpoint = 'mock' OR 
  tracking_endpoint = 'mock' OR
  label_endpoint = 'tcs'
);

-- Step 2: Drop the existing constraint
ALTER TABLE public.couriers
DROP CONSTRAINT IF EXISTS couriers_valid_endpoints;

-- Step 3: Add new endpoint columns
ALTER TABLE public.couriers
ADD COLUMN IF NOT EXISTS cancellation_endpoint TEXT,
ADD COLUMN IF NOT EXISTS update_endpoint TEXT,
ADD COLUMN IF NOT EXISTS rates_endpoint TEXT;

-- Step 4: Recreate the check constraint with all endpoints
ALTER TABLE public.couriers
ADD CONSTRAINT couriers_valid_endpoints CHECK (
  (api_endpoint IS NULL OR api_endpoint ~* '^https?://') AND
  (booking_endpoint IS NULL OR booking_endpoint ~* '^https?://') AND
  (tracking_endpoint IS NULL OR tracking_endpoint ~* '^https?://') AND
  (label_endpoint IS NULL OR label_endpoint ~* '^https?://') AND
  (cancellation_endpoint IS NULL OR cancellation_endpoint ~* '^https?://') AND
  (update_endpoint IS NULL OR update_endpoint ~* '^https?://') AND
  (rates_endpoint IS NULL OR rates_endpoint ~* '^https?://')
);

-- Step 5: Add helpful comments
COMMENT ON COLUMN public.couriers.cancellation_endpoint IS 'API endpoint for cancelling courier bookings';
COMMENT ON COLUMN public.couriers.update_endpoint IS 'API endpoint for updating order details';
COMMENT ON COLUMN public.couriers.rates_endpoint IS 'API endpoint for fetching shipping rates/tariffs';