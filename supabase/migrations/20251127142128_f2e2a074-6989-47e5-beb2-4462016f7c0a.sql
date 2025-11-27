-- Set correct header name for PostEx tracking API
UPDATE public.couriers
SET auth_config = jsonb_set(
  COALESCE(auth_config, '{}'::jsonb),
  '{header_name}',
  '"token"'
)
WHERE code = 'postex';