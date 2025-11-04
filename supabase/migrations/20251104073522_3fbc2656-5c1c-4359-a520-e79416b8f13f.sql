-- Create sync_queue table for managing bidirectional Shopify synchronization
CREATE TABLE IF NOT EXISTS public.sync_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type TEXT NOT NULL CHECK (entity_type IN ('order', 'product', 'customer', 'inventory')),
  entity_id UUID NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('create', 'update', 'delete')),
  direction TEXT NOT NULL CHECK (direction IN ('to_shopify', 'from_shopify')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  retry_count INTEGER NOT NULL DEFAULT 0,
  error_message TEXT,
  payload JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  processed_at TIMESTAMP WITH TIME ZONE,
  CONSTRAINT retry_limit CHECK (retry_count <= 5)
);

-- Create index for efficient queue processing
CREATE INDEX idx_sync_queue_status_created ON sync_queue(status, created_at) WHERE status IN ('pending', 'failed');
CREATE INDEX idx_sync_queue_entity ON sync_queue(entity_type, entity_id);

-- Enable RLS
ALTER TABLE public.sync_queue ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Managers can view sync queue"
  ON public.sync_queue FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
        AND role IN ('super_admin', 'super_manager', 'warehouse_manager', 'dispatch_manager')
        AND is_active = true
    )
  );

CREATE POLICY "System can manage sync queue"
  ON public.sync_queue FOR ALL
  USING (true);

-- Add columns to orders table for Shopify sync tracking
ALTER TABLE public.orders 
  ADD COLUMN IF NOT EXISTS shopify_sync_status TEXT DEFAULT 'pending' CHECK (shopify_sync_status IN ('pending', 'synced', 'failed', 'disabled'));

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS shopify_last_sync_at TIMESTAMP WITH TIME ZONE;

-- Add columns to inventory table for Shopify sync
ALTER TABLE public.inventory
  ADD COLUMN IF NOT EXISTS last_shopify_sync TIMESTAMP WITH TIME ZONE;

ALTER TABLE public.inventory
  ADD COLUMN IF NOT EXISTS shopify_location_id BIGINT;

-- Add columns to products table for Shopify sync
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS shopify_inventory_item_id BIGINT;

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS sync_to_shopify BOOLEAN DEFAULT true;

-- Function to queue order sync to Shopify
CREATE OR REPLACE FUNCTION queue_order_sync_to_shopify()
RETURNS TRIGGER AS $$
DECLARE
  auto_sync_enabled TEXT;
BEGIN
  -- Check if auto-sync is enabled
  SELECT setting_value INTO auto_sync_enabled
  FROM api_settings
  WHERE setting_key = 'SHOPIFY_AUTO_SYNC_ORDERS';

  -- Only queue if auto-sync is enabled and order is not from Shopify
  IF auto_sync_enabled = 'true' AND NEW.shopify_order_id IS NULL THEN
    -- For new orders, queue create action
    IF TG_OP = 'INSERT' THEN
      INSERT INTO sync_queue (entity_type, entity_id, action, direction, payload)
      VALUES ('order', NEW.id, 'create', 'to_shopify', jsonb_build_object('order_id', NEW.id));
    
    -- For updates, queue update action (only if key fields changed)
    ELSIF TG_OP = 'UPDATE' AND (
      OLD.status IS DISTINCT FROM NEW.status OR
      OLD.tracking_id IS DISTINCT FROM NEW.tracking_id OR
      OLD.customer_name IS DISTINCT FROM NEW.customer_name OR
      OLD.customer_address IS DISTINCT FROM NEW.customer_address
    ) THEN
      INSERT INTO sync_queue (entity_type, entity_id, action, direction, payload)
      VALUES ('order', NEW.id, 'update', 'to_shopify', jsonb_build_object('order_id', NEW.id))
      ON CONFLICT DO NOTHING;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Trigger for order changes
DROP TRIGGER IF EXISTS trigger_queue_order_sync ON orders;
CREATE TRIGGER trigger_queue_order_sync
  AFTER INSERT OR UPDATE ON orders
  FOR EACH ROW
  EXECUTE FUNCTION queue_order_sync_to_shopify();

-- Function to queue inventory sync to Shopify
CREATE OR REPLACE FUNCTION queue_inventory_sync_to_shopify()
RETURNS TRIGGER AS $$
DECLARE
  auto_sync_enabled TEXT;
  product_should_sync BOOLEAN;
BEGIN
  -- Check if auto-sync is enabled
  SELECT setting_value INTO auto_sync_enabled
  FROM api_settings
  WHERE setting_key = 'SHOPIFY_AUTO_SYNC_INVENTORY';

  -- Check if product should sync
  SELECT sync_to_shopify INTO product_should_sync
  FROM products
  WHERE id = NEW.product_id;

  -- Only queue if auto-sync is enabled and product should sync
  IF auto_sync_enabled = 'true' AND product_should_sync = true THEN
    -- Queue inventory update (only if quantity changed)
    IF TG_OP = 'UPDATE' AND OLD.quantity IS DISTINCT FROM NEW.quantity THEN
      INSERT INTO sync_queue (entity_type, entity_id, action, direction, payload)
      VALUES ('inventory', NEW.id, 'update', 'to_shopify', 
        jsonb_build_object(
          'inventory_id', NEW.id,
          'product_id', NEW.product_id,
          'outlet_id', NEW.outlet_id,
          'quantity', NEW.quantity
        )
      )
      ON CONFLICT DO NOTHING;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Trigger for inventory changes
DROP TRIGGER IF EXISTS trigger_queue_inventory_sync ON inventory;
CREATE TRIGGER trigger_queue_inventory_sync
  AFTER UPDATE ON inventory
  FOR EACH ROW
  EXECUTE FUNCTION queue_inventory_sync_to_shopify();