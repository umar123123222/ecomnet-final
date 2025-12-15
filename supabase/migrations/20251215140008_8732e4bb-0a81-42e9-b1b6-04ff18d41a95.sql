-- Add SHOPIFY_WEBHOOK_SECRET to api_settings for HMAC verification
INSERT INTO api_settings (setting_key, setting_value, description)
VALUES ('SHOPIFY_WEBHOOK_SECRET', '', 'Shopify webhook secret for HMAC verification. Found in Shopify Admin > Settings > Notifications > Webhooks')
ON CONFLICT (setting_key) DO NOTHING;