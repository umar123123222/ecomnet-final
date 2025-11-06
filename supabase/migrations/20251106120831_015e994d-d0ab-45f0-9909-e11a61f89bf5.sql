-- Create trigger function for syncing order changes to Shopify
CREATE OR REPLACE FUNCTION sync_order_to_shopify()
RETURNS TRIGGER AS $$
BEGIN
  -- Only sync if order has shopify_order_id (already synced to Shopify)
  IF NEW.shopify_order_id IS NOT NULL THEN
    -- Insert into sync_queue for async processing
    INSERT INTO sync_queue (
      entity_type,
      entity_id,
      action,
      direction,
      data,
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
$$ LANGUAGE plpgsql;

-- Create trigger on orders table for updates
DROP TRIGGER IF EXISTS order_updated_sync_trigger ON orders;
CREATE TRIGGER order_updated_sync_trigger
AFTER UPDATE ON orders
FOR EACH ROW
WHEN (
  OLD.status IS DISTINCT FROM NEW.status OR
  OLD.tracking_id IS DISTINCT FROM NEW.tracking_id OR
  OLD.customer_address IS DISTINCT FROM NEW.customer_address OR
  OLD.customer_new_address IS DISTINCT FROM NEW.customer_new_address OR
  OLD.tags IS DISTINCT FROM NEW.tags OR
  OLD.notes IS DISTINCT FROM NEW.notes OR
  OLD.customer_name IS DISTINCT FROM NEW.customer_name OR
  OLD.customer_phone IS DISTINCT FROM NEW.customer_phone OR
  OLD.city IS DISTINCT FROM NEW.city
)
EXECUTE FUNCTION sync_order_to_shopify();