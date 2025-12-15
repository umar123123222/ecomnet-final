-- Create function to check and alert on negative inventory
CREATE OR REPLACE FUNCTION public.alert_on_negative_inventory()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_product_name TEXT;
  v_outlet_name TEXT;
  v_alert_exists BOOLEAN;
BEGIN
  -- Only trigger when quantity goes negative
  IF NEW.quantity < 0 AND (OLD.quantity >= 0 OR OLD.quantity IS NULL) THEN
    -- Get product and outlet names
    SELECT name INTO v_product_name FROM products WHERE id = NEW.product_id;
    SELECT name INTO v_outlet_name FROM outlets WHERE id = NEW.outlet_id;
    
    -- Check if active alert already exists for this inventory item
    SELECT EXISTS (
      SELECT 1 FROM automated_alerts 
      WHERE entity_id = NEW.id 
        AND entity_type = 'inventory' 
        AND alert_type = 'negative_inventory'
        AND status = 'active'
    ) INTO v_alert_exists;
    
    -- Only create alert if one doesn't already exist
    IF NOT v_alert_exists THEN
      INSERT INTO automated_alerts (
        alert_type,
        entity_type,
        entity_id,
        severity,
        title,
        message,
        metadata,
        status
      ) VALUES (
        'negative_inventory',
        'inventory',
        NEW.id,
        'critical',
        'Negative Inventory: ' || COALESCE(v_product_name, 'Unknown Product'),
        'Product "' || COALESCE(v_product_name, 'Unknown') || '" at "' || COALESCE(v_outlet_name, 'Unknown') || '" has negative stock: ' || NEW.quantity || ' units (oversold)',
        jsonb_build_object(
          'product_id', NEW.product_id,
          'outlet_id', NEW.outlet_id,
          'product_name', v_product_name,
          'outlet_name', v_outlet_name,
          'quantity', NEW.quantity,
          'previous_quantity', OLD.quantity
        ),
        'active'
      );
    ELSE
      -- Update existing alert with new quantity
      UPDATE automated_alerts 
      SET 
        message = 'Product "' || COALESCE(v_product_name, 'Unknown') || '" at "' || COALESCE(v_outlet_name, 'Unknown') || '" has negative stock: ' || NEW.quantity || ' units (oversold)',
        metadata = jsonb_build_object(
          'product_id', NEW.product_id,
          'outlet_id', NEW.outlet_id,
          'product_name', v_product_name,
          'outlet_name', v_outlet_name,
          'quantity', NEW.quantity,
          'previous_quantity', OLD.quantity
        ),
        updated_at = NOW()
      WHERE entity_id = NEW.id 
        AND entity_type = 'inventory' 
        AND alert_type = 'negative_inventory'
        AND status = 'active';
    END IF;
  END IF;
  
  -- Auto-resolve alert when inventory becomes non-negative
  IF NEW.quantity >= 0 AND OLD.quantity < 0 THEN
    UPDATE automated_alerts 
    SET 
      status = 'resolved',
      resolved_at = NOW()
    WHERE entity_id = NEW.id 
      AND entity_type = 'inventory' 
      AND alert_type = 'negative_inventory'
      AND status = 'active';
  END IF;
  
  RETURN NEW;
END;
$function$;

-- Create trigger for negative inventory alerts
DROP TRIGGER IF EXISTS trigger_alert_negative_inventory ON inventory;
CREATE TRIGGER trigger_alert_negative_inventory
  AFTER UPDATE ON inventory
  FOR EACH ROW
  EXECUTE FUNCTION alert_on_negative_inventory();