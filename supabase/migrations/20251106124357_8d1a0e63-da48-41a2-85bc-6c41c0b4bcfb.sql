-- Remove conflicting BEFORE INSERT trigger that prevents Shopify orders from being created
DROP TRIGGER IF EXISTS trigger_schedule_order_confirmation ON orders;

-- Remove the old function that's no longer needed
DROP FUNCTION IF EXISTS schedule_order_confirmation();

-- The new create_order_confirmation_trigger (AFTER INSERT) will handle all order confirmations
-- It only creates confirmations for non-Shopify orders where shopify_order_id IS NULL