-- Disable automatic order confirmation creation for Shopify orders
-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS create_order_confirmation_trigger ON orders;

-- Create improved trigger that only creates confirmations for non-Shopify orders
CREATE OR REPLACE FUNCTION create_order_confirmation()
RETURNS TRIGGER AS $$
BEGIN
  -- Only create confirmation for orders that DON'T have shopify_order_id
  -- Shopify orders are already confirmed through Shopify's system
  IF NEW.shopify_order_id IS NULL AND NEW.confirmation_required = true THEN
    INSERT INTO order_confirmations (
      order_id,
      customer_id,
      confirmation_type,
      status,
      created_at
    ) VALUES (
      NEW.id,
      NEW.customer_id,
      'order',
      'pending',
      NOW()
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Recreate trigger with AFTER INSERT to ensure order exists first
CREATE TRIGGER create_order_confirmation_trigger
AFTER INSERT ON orders
FOR EACH ROW
EXECUTE FUNCTION create_order_confirmation();