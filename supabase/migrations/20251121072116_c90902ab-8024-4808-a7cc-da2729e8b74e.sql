-- Fix invalid courier endpoint configurations
UPDATE couriers 
SET 
  api_endpoint = 'mock',
  booking_endpoint = 'mock', 
  tracking_endpoint = 'mock'
WHERE code IN ('tcs', 'leopard') 
  AND (api_endpoint NOT LIKE 'http%' OR api_endpoint IN ('tcs', 'dd', 'leopard'));

-- Add check constraint to prevent invalid URLs in future
ALTER TABLE couriers DROP CONSTRAINT IF EXISTS couriers_valid_endpoints;
ALTER TABLE couriers ADD CONSTRAINT couriers_valid_endpoints 
  CHECK (
    (api_endpoint LIKE 'http%' OR api_endpoint = 'mock') AND
    (booking_endpoint IS NULL OR booking_endpoint LIKE 'http%' OR booking_endpoint = 'mock') AND
    (tracking_endpoint IS NULL OR tracking_endpoint LIKE 'http%' OR tracking_endpoint = 'mock')
  );