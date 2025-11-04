-- Create shopify_webhook_registry table to track registered webhooks
CREATE TABLE IF NOT EXISTS public.shopify_webhook_registry (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  webhook_id BIGINT UNIQUE NOT NULL,
  topic TEXT NOT NULL,
  address TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'error')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  last_triggered TIMESTAMP WITH TIME ZONE,
  error_message TEXT
);

-- Enable RLS
ALTER TABLE public.shopify_webhook_registry ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Super admins can view webhooks"
  ON public.shopify_webhook_registry FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
        AND role = 'super_admin'
        AND is_active = true
    )
  );

CREATE POLICY "System can manage webhooks"
  ON public.shopify_webhook_registry FOR ALL
  USING (true);

-- Add auto-sync settings defaults
INSERT INTO api_settings (setting_key, setting_value, description)
VALUES 
  ('SHOPIFY_AUTO_SYNC_ORDERS', 'true', 'Automatically sync orders to Shopify'),
  ('SHOPIFY_AUTO_SYNC_INVENTORY', 'false', 'Automatically sync inventory to Shopify'),
  ('SHOPIFY_AUTO_SYNC_PRODUCTS', 'false', 'Automatically sync products to Shopify'),
  ('SHOPIFY_AUTO_SYNC_CUSTOMERS', 'false', 'Automatically sync customers to Shopify'),
  ('SHOPIFY_DEFAULT_LOCATION_ID', '', 'Default Shopify location ID for inventory')
ON CONFLICT (setting_key) DO NOTHING;