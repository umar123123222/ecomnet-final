-- Fix sync_order_to_shopify function to use correct column name
DROP FUNCTION IF EXISTS public.sync_order_to_shopify() CASCADE;

CREATE OR REPLACE FUNCTION public.sync_order_to_shopify()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
  -- Only sync if order has shopify_order_id (already synced to Shopify)
  IF NEW.shopify_order_id IS NOT NULL THEN
    -- Insert into sync_queue for async processing
    INSERT INTO sync_queue (
      entity_type,
      entity_id,
      action,
      direction,
      payload,
      status
    ) VALUES (
      'order',
      NEW.id,
      'update',
      'to_shopify',
      jsonb_build_object(
        'order_id', NEW.id,
        'shopify_order_id', NEW.shopify_order_id,
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
      ),
      'pending'
    );
  END IF;
  RETURN NEW;
END;
$function$;