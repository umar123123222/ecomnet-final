-- Populate missing endpoint URLs for existing couriers

-- Update Leopard courier with all endpoints
UPDATE public.couriers
SET 
  cancellation_endpoint = 'https://merchantapi.leopardscourier.com/api/cancel-packet',
  rates_endpoint = 'https://merchantapi.leopardscourier.com/api/getTariffDetails'
WHERE code = 'leopard';

-- Update Postex courier with all endpoints
UPDATE public.couriers
SET 
  cancellation_endpoint = 'https://api.postex.pk/services/integration/api/order/v1/cancel-order',
  rates_endpoint = 'https://api.postex.pk/services/integration/api/shipment/v1/calculate-charges'
WHERE code = 'postex';

-- Update TCS courier with all endpoints
UPDATE public.couriers
SET 
  cancellation_endpoint = 'https://api.tcs.com.pk/api/v1/cancellations',
  rates_endpoint = 'https://api.tcs.com.pk/api/v1/rates/calculate'
WHERE code = 'tcs';