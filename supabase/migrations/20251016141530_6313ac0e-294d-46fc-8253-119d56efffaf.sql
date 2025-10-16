-- Enable pg_cron extension for scheduled jobs
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Schedule low stock check to run daily at 9 AM
SELECT cron.schedule(
  'check-low-stock-daily',
  '0 9 * * *', -- Run at 9 AM every day
  $$
  SELECT
    net.http_post(
        url:='https://lzitfcigdjbpymvebipp.supabase.co/functions/v1/check-low-stock',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx6aXRmY2lnZGpicHltdmViaXBwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTEwMTMzODAsImV4cCI6MjA2NjU4OTM4MH0.JvlZ7f0jamxZxv5ti9UOamF0iL_ZwlMpbquFhzWARZk"}'::jsonb
    ) as request_id;
  $$
);