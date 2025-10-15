-- Create table for API configurations
CREATE TABLE IF NOT EXISTS public.api_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  setting_key TEXT NOT NULL UNIQUE,
  setting_value TEXT NOT NULL,
  description TEXT,
  updated_by UUID REFERENCES auth.users(id),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.api_settings ENABLE ROW LEVEL SECURITY;

-- Only super_admin can view API settings
CREATE POLICY "Super admins can view API settings"
  ON public.api_settings
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = 'super_admin'
      AND user_roles.is_active = true
    )
  );

-- Only super_admin can manage API settings
CREATE POLICY "Super admins can manage API settings"
  ON public.api_settings
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = 'super_admin'
      AND user_roles.is_active = true
    )
  );

-- Create trigger to update updated_at
CREATE TRIGGER update_api_settings_updated_at
  BEFORE UPDATE ON public.api_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default API settings
INSERT INTO public.api_settings (setting_key, setting_value, description) VALUES
  ('WHATSAPP_ACCESS_TOKEN', '', 'WhatsApp Business API Access Token'),
  ('WHATSAPP_PHONE_NUMBER_ID', '', 'WhatsApp Business Phone Number ID'),
  ('TCS_API_KEY', '', 'TCS Courier API Key'),
  ('LEOPARD_API_KEY', '', 'Leopard Courier API Key'),
  ('POSTEX_API_KEY', '', 'PostEx Courier API Key'),
  ('SHOPIFY_STORE_URL', '', 'Shopify Store URL'),
  ('SHOPIFY_ADMIN_API_TOKEN', '', 'Shopify Admin API Access Token'),
  ('SHOPIFY_API_VERSION', '2024-01', 'Shopify API Version')
ON CONFLICT (setting_key) DO NOTHING;

-- Add comment
COMMENT ON TABLE public.api_settings IS 'Stores API configuration settings that can be managed by super admins';