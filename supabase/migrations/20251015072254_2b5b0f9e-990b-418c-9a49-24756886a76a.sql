-- Phase 1: Database Schema for Shopify, WhatsApp, and Courier Integrations

-- Create new table: couriers
CREATE TABLE IF NOT EXISTS public.couriers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  code TEXT NOT NULL UNIQUE CHECK (code IN ('tcs', 'leopard', 'postex', 'other')),
  api_endpoint TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  supported_cities JSONB DEFAULT '[]'::jsonb,
  pricing_config JSONB DEFAULT '{}'::jsonb,
  config JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Seed couriers table
INSERT INTO public.couriers (name, code, api_endpoint, is_active) VALUES
  ('TCS', 'tcs', 'https://api.tcs.com.pk/v1', true),
  ('Leopard Courier', 'leopard', 'https://api.leopardscourier.com/api/v1', true),
  ('PostEx', 'postex', 'https://api.postex.pk/services', true),
  ('Other', 'other', '', true)
ON CONFLICT (code) DO NOTHING;

-- Create courier_rate_cards table
CREATE TABLE IF NOT EXISTS public.courier_rate_cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  courier_id UUID REFERENCES public.couriers(id) ON DELETE CASCADE NOT NULL,
  origin_city TEXT NOT NULL,
  destination_city TEXT NOT NULL,
  weight_from NUMERIC NOT NULL,
  weight_to NUMERIC NOT NULL,
  rate NUMERIC NOT NULL,
  estimated_days INTEGER,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create shopify_sync_log table
CREATE TABLE IF NOT EXISTS public.shopify_sync_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sync_type TEXT NOT NULL CHECK (sync_type IN ('orders', 'customers', 'products', 'full')),
  sync_direction TEXT NOT NULL CHECK (sync_direction IN ('from_shopify', 'to_shopify')),
  status TEXT NOT NULL CHECK (status IN ('success', 'partial', 'failed', 'in_progress')),
  records_processed INTEGER DEFAULT 0,
  records_failed INTEGER DEFAULT 0,
  error_details JSONB,
  started_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ,
  triggered_by UUID REFERENCES auth.users(id)
);

-- Create whatsapp_templates table
CREATE TABLE IF NOT EXISTS public.whatsapp_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  template_id TEXT NOT NULL,
  category TEXT NOT NULL,
  language TEXT DEFAULT 'en',
  body_text TEXT NOT NULL,
  header_text TEXT,
  footer_text TEXT,
  button_config JSONB,
  variables JSONB DEFAULT '[]'::jsonb,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Create whatsapp_message_queue table
CREATE TABLE IF NOT EXISTS public.whatsapp_message_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
  order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
  phone_number TEXT NOT NULL,
  template_name TEXT,
  message_text TEXT NOT NULL,
  variables JSONB,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed', 'rate_limited')),
  whatsapp_message_id TEXT,
  attempts INTEGER DEFAULT 0,
  last_error TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  sent_at TIMESTAMPTZ
);

-- Enhance orders table
ALTER TABLE public.orders 
  ADD COLUMN IF NOT EXISTS shopify_order_id BIGINT,
  ADD COLUMN IF NOT EXISTS shopify_order_number TEXT,
  ADD COLUMN IF NOT EXISTS shopify_fulfillment_id BIGINT,
  ADD COLUMN IF NOT EXISTS synced_to_shopify BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS last_shopify_sync TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_orders_shopify_id ON public.orders(shopify_order_id);
CREATE INDEX IF NOT EXISTS idx_orders_shopify_number ON public.orders(shopify_order_number);

-- Enhance customers table
ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS shopify_customer_id BIGINT,
  ADD COLUMN IF NOT EXISTS whatsapp_opt_in BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS last_whatsapp_sent TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_customers_shopify_id ON public.customers(shopify_customer_id);

-- Enhance products table
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS shopify_product_id BIGINT,
  ADD COLUMN IF NOT EXISTS shopify_variant_id BIGINT,
  ADD COLUMN IF NOT EXISTS synced_from_shopify BOOLEAN DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_products_shopify_id ON public.products(shopify_product_id);

-- Enhance dispatches table
ALTER TABLE public.dispatches
  ADD COLUMN IF NOT EXISTS courier_id UUID REFERENCES public.couriers(id),
  ADD COLUMN IF NOT EXISTS courier_booking_id TEXT,
  ADD COLUMN IF NOT EXISTS courier_response JSONB,
  ADD COLUMN IF NOT EXISTS estimated_delivery TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_tracking_update TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_dispatches_courier_booking ON public.dispatches(courier_booking_id);
CREATE INDEX IF NOT EXISTS idx_dispatches_courier_id ON public.dispatches(courier_id);

-- Enable RLS on new tables
ALTER TABLE public.couriers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.courier_rate_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shopify_sync_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_message_queue ENABLE ROW LEVEL SECURITY;

-- RLS Policies for couriers
CREATE POLICY "Authenticated users can view couriers" 
  ON public.couriers FOR SELECT 
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Managers can manage couriers" 
  ON public.couriers FOR ALL 
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() 
      AND role IN ('super_admin', 'super_manager')
    )
  );

-- RLS Policies for courier_rate_cards
CREATE POLICY "Authenticated users can view rate cards" 
  ON public.courier_rate_cards FOR SELECT 
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Managers can manage rate cards" 
  ON public.courier_rate_cards FOR ALL 
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() 
      AND role IN ('super_admin', 'super_manager', 'warehouse_manager')
    )
  );

-- RLS Policies for shopify_sync_log
CREATE POLICY "Managers can view sync logs" 
  ON public.shopify_sync_log FOR SELECT 
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() 
      AND role IN ('super_admin', 'super_manager')
    )
  );

CREATE POLICY "System can create sync logs" 
  ON public.shopify_sync_log FOR INSERT 
  WITH CHECK (true);

-- RLS Policies for whatsapp_templates
CREATE POLICY "Authenticated users can view templates" 
  ON public.whatsapp_templates FOR SELECT 
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Managers can manage templates" 
  ON public.whatsapp_templates FOR ALL 
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() 
      AND role IN ('super_admin', 'super_manager')
    )
  );

-- RLS Policies for whatsapp_message_queue
CREATE POLICY "Authenticated users can view message queue" 
  ON public.whatsapp_message_queue FOR SELECT 
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "System can manage message queue" 
  ON public.whatsapp_message_queue FOR ALL 
  USING (true);

-- Create update trigger for couriers
CREATE TRIGGER update_couriers_updated_at
  BEFORE UPDATE ON public.couriers
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create update trigger for courier_rate_cards
CREATE TRIGGER update_courier_rate_cards_updated_at
  BEFORE UPDATE ON public.courier_rate_cards
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Seed WhatsApp templates
INSERT INTO public.whatsapp_templates (name, template_id, category, body_text, variables) VALUES
  (
    'order_confirmation',
    'order_confirmation_template',
    'order_confirmation',
    'Hello {{1}}! 🎉\n\nYour order {{2}} has been confirmed.\n\nTotal Amount: Rs. {{3}}\n\nWe will notify you when your order is dispatched.\n\nThank you for shopping with us!',
    '["customer_name", "order_number", "total_amount"]'::jsonb
  ),
  (
    'dispatch_notification',
    'dispatch_notification_template',
    'dispatch',
    'Good news {{1}}! 📦\n\nYour order {{2}} has been dispatched via {{3}}.\n\nTracking ID: {{4}}\n\nExpected delivery: {{5}}',
    '["customer_name", "order_number", "courier_name", "tracking_id", "estimated_delivery"]'::jsonb
  ),
  (
    'delivery_confirmation',
    'delivery_confirmation_template',
    'delivery',
    'Great news {{1}}! ✅\n\nYour order {{2}} has been delivered successfully.\n\nWe hope you love your purchase!\n\nNeed help? Reply to this message.',
    '["customer_name", "order_number"]'::jsonb
  ),
  (
    'return_initiated',
    'return_initiated_template',
    'return',
    'Hi {{1}},\n\nYour return request for order {{2}} has been accepted.\n\nReturn Tracking: {{3}}\n\nOur courier will collect the item within 2-3 business days.',
    '["customer_name", "order_number", "return_tracking_id"]'::jsonb
  )
ON CONFLICT (name) DO NOTHING;