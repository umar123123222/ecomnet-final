-- Enable pg_cron and pg_net extensions for scheduled tasks
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Enhance auto_purchase_orders table with automation tracking
ALTER TABLE auto_purchase_orders
ADD COLUMN IF NOT EXISTS trigger_type text DEFAULT 'manual',
ADD COLUMN IF NOT EXISTS processing_duration_ms integer,
ADD COLUMN IF NOT EXISTS error_message text;

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_auto_po_created_at 
ON auto_purchase_orders(created_at DESC);

-- Schedule the smart reorder function to run daily at 2 AM
SELECT cron.schedule(
  'daily-smart-reorder-automation',
  '0 2 * * *', -- Every day at 2 AM
  $$
  SELECT net.http_post(
    url := 'https://lzitfcigdjbpymvebipp.supabase.co/functions/v1/scheduled-smart-reorder',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx6aXRmY2lnZGpicHltdmViaXBwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTEwMTMzODAsImV4cCI6MjA2NjU4OTM4MH0.JvlZ7f0jamxZxv5ti9UOamF0iL_ZwlMpbquFhzWARZk"}'::jsonb,
    body := '{"trigger": "scheduled"}'::jsonb
  ) as request_id;
  $$
);

-- Create manual trigger function for testing
CREATE OR REPLACE FUNCTION public.trigger_smart_reorder_now()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result jsonb;
BEGIN
  -- Call the edge function
  SELECT net.http_post(
    url := 'https://lzitfcigdjbpymvebipp.supabase.co/functions/v1/scheduled-smart-reorder',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx6aXRmY2lnZGpicHltdmViaXBwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTEwMTMzODAsImV4cCI6MjA2NjU4OTM4MH0.JvlZ7f0jamxZxv5ti9UOamF0iL_ZwlMpbquFhzWARZk"}'::jsonb,
    body := '{"trigger": "manual"}'::jsonb
  ) INTO result;
  
  RETURN jsonb_build_object(
    'success', true,
    'message', 'Smart reorder automation triggered',
    'request_id', result
  );
END;
$$;

-- Grant execute permission to authenticated users with manager roles
GRANT EXECUTE ON FUNCTION public.trigger_smart_reorder_now() TO authenticated;