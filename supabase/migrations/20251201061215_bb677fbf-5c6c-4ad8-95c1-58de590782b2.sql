-- Add LEOPARD_API_PASSWORD setting
INSERT INTO api_settings (setting_key, setting_value, description)
VALUES ('LEOPARD_API_PASSWORD', '', 'Leopard Courier API Password')
ON CONFLICT (setting_key) DO NOTHING;

-- Update Leopard courier configuration
-- Use 'api_key_header' as auth_type but we'll handle Leopard specifically in code
UPDATE couriers 
SET 
  auth_type = 'api_key_header',
  auth_config = '{"requires_password": true, "method": "POST"}'::jsonb,
  tracking_endpoint = 'https://merchantapi.leopardscourier.com/api/trackBookedPacket/format/json/',
  booking_endpoint = 'https://merchantapi.leopardscourier.com/api/bookPacket/format/json/',
  cancellation_endpoint = 'https://merchantapi.leopardscourier.com/api/cancelBookedPackets/format/json/',
  rates_endpoint = 'https://merchantapi.leopardscourier.com/api/rate_calculator/format/json/',
  label_endpoint = 'https://merchantapi.leopardscourier.com/api/printLabelOfCNS/format/json/',
  updated_at = now()
WHERE code = 'leopard';