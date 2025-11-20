-- Update the queue_order_sync_to_shopify trigger to include status in payload
CREATE OR REPLACE FUNCTION public.queue_order_sync_to_shopify()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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
$function$;