SELECT cron.schedule(
  'nightly-tracking-update',
  '0 19 * * *',
  $$
  SELECT net.http_post(
    url:='https://lzitfcigdjbpymvebipp.supabase.co/functions/v1/nightly-tracking-update',
    headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx6aXRmY2lnZGpicHltdmViaXBwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTEwMTMzODAsImV4cCI6MjA2NjU4OTM4MH0.JvlZ7f0jamxZxv5ti9UOamF0iL_ZwlMpbquFhzWARZk"}'::jsonb,
    body:='{"trigger": "scheduled"}'::jsonb
  ) as request_id;
  $$
);