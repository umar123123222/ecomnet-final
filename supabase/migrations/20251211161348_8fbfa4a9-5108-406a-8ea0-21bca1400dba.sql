-- Update the queue_order_sync_to_shopify function to:
-- 1. Track user who made the change
-- 2. Skip address sync if change came from Shopify webhook (within 10 seconds)
-- 3. Add is_user_change and address_changed flags

CREATE OR REPLACE FUNCTION queue_order_sync_to_shopify()
RETURNS TRIGGER AS $$
DECLARE
  auto_sync_enabled TEXT;
  current_user_id UUID;
  is_user_change BOOLEAN;
  address_changed BOOLEAN;
  skip_address_sync BOOLEAN;
BEGIN
  -- Check if auto-sync is enabled
  SELECT setting_value INTO auto_sync_enabled
  FROM api_settings
  WHERE setting_key = 'SHOPIFY_AUTO_SYNC_ORDERS';

  -- Only proceed if auto-sync is enabled
  IF auto_sync_enabled = 'true' THEN
    -- Get current user ID
    current_user_id := auth.uid();
    
    -- Determine if this is a real user change (not system/webhook)
    is_user_change := current_user_id IS NOT NULL 
                      AND current_user_id != '00000000-0000-0000-0000-000000000000'::UUID;
    
    -- Check if address changed
    address_changed := (OLD.customer_address IS DISTINCT FROM NEW.customer_address OR 
                        OLD.city IS DISTINCT FROM NEW.city OR
                        OLD.customer_name IS DISTINCT FROM NEW.customer_name OR
                        OLD.customer_phone IS DISTINCT FROM NEW.customer_phone);
    
    -- Skip address sync if:
    -- 1. Address changed AND
    -- 2. last_shopify_sync was just updated (within 10 seconds) - indicates Shopify webhook origin
    skip_address_sync := address_changed AND 
                         NEW.last_shopify_sync IS NOT NULL AND
                         NEW.last_shopify_sync > (NOW() - INTERVAL '10 seconds');
    
    -- For new orders WITHOUT shopify_order_id, queue create action
    IF TG_OP = 'INSERT' AND NEW.shopify_order_id IS NULL THEN
      INSERT INTO sync_queue (entity_type, entity_id, action, direction, payload)
      VALUES ('order', NEW.id, 'create', 'to_shopify', jsonb_build_object('order_id', NEW.id));
    
    -- For updates to orders WITH shopify_order_id, sync changes back to Shopify
    ELSIF TG_OP = 'UPDATE' AND NEW.shopify_order_id IS NOT NULL AND (
      OLD.status IS DISTINCT FROM NEW.status OR
      OLD.tracking_id IS DISTINCT FROM NEW.tracking_id OR
      OLD.customer_name IS DISTINCT FROM NEW.customer_name OR
      OLD.customer_address IS DISTINCT FROM NEW.customer_address OR
      OLD.city IS DISTINCT FROM NEW.city OR
      OLD.tags IS DISTINCT FROM NEW.tags OR
      OLD.notes IS DISTINCT FROM NEW.notes OR
      OLD.customer_phone IS DISTINCT FROM NEW.customer_phone
    ) THEN
      INSERT INTO sync_queue (entity_type, entity_id, action, direction, payload)
      VALUES ('order', NEW.id, 'update', 'to_shopify', 
        jsonb_build_object(
          'order_id', NEW.id,
          'changed_by', current_user_id,
          'is_user_change', is_user_change,
          'address_changed', address_changed,
          'skip_address_sync', skip_address_sync,
          'changes', jsonb_build_object(
            'status', NEW.status,
            'tracking_id', NEW.tracking_id,
            'customer_address', NEW.customer_address,
            'customer_new_address', NEW.customer_new_address,
            'city', NEW.city,
            'tags', NEW.tags,
            'notes', NEW.notes,
            'customer_name', NEW.customer_name,
            'customer_phone', NEW.customer_phone
          )
        )
      )
      ON CONFLICT DO NOTHING;
    
    -- For updates to orders WITHOUT shopify_order_id, also queue updates
    ELSIF TG_OP = 'UPDATE' AND NEW.shopify_order_id IS NULL AND (
      OLD.status IS DISTINCT FROM NEW.status OR
      OLD.tracking_id IS DISTINCT FROM NEW.tracking_id OR
      OLD.customer_name IS DISTINCT FROM NEW.customer_name OR
      OLD.customer_address IS DISTINCT FROM NEW.customer_address OR
      OLD.city IS DISTINCT FROM NEW.city OR
      OLD.tags IS DISTINCT FROM NEW.tags OR
      OLD.notes IS DISTINCT FROM NEW.notes OR
      OLD.customer_phone IS DISTINCT FROM NEW.customer_phone
    ) THEN
      INSERT INTO sync_queue (entity_type, entity_id, action, direction, payload)
      VALUES ('order', NEW.id, 'update', 'to_shopify', 
        jsonb_build_object(
          'order_id', NEW.id,
          'changed_by', current_user_id,
          'is_user_change', is_user_change,
          'address_changed', address_changed,
          'skip_address_sync', skip_address_sync,
          'changes', jsonb_build_object(
            'status', NEW.status,
            'tracking_id', NEW.tracking_id,
            'customer_address', NEW.customer_address,
            'customer_new_address', NEW.customer_new_address,
            'city', NEW.city,
            'tags', NEW.tags,
            'notes', NEW.notes,
            'customer_name', NEW.customer_name,
            'customer_phone', NEW.customer_phone
          )
        )
      )
      ON CONFLICT DO NOTHING;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;