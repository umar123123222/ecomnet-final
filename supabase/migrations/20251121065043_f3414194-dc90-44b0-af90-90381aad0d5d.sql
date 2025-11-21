-- Create trigger to sync order status changes to Shopify
-- This automatically adds Ecomnet status tags when orders are confirmed, booked, etc.

CREATE OR REPLACE FUNCTION queue_order_status_sync()
RETURNS TRIGGER AS $$
BEGIN
  -- Only queue sync if order has shopify_order_id OR if it's a status that should be synced
  -- Status changes that should be synced: confirmed, booked, dispatched
  IF (OLD.status IS DISTINCT FROM NEW.status) AND 
     (NEW.status IN ('confirmed', 'booked', 'dispatched', 'delivered', 'returned', 'cancelled')) THEN
    
    -- Insert into sync queue
    INSERT INTO sync_queue (entity_type, entity_id, action, direction, payload, status)
    VALUES (
      'order',
      NEW.id,
      'update',
      'to_shopify',
      jsonb_build_object(
        'order_id', NEW.id,
        'changes', jsonb_build_object(
          'status', NEW.status,
          'tags', NEW.tags
        )
      ),
      'pending'
    )
    ON CONFLICT DO NOTHING;
    
    RAISE NOTICE 'Queued status sync for order %: % -> %', NEW.order_number, OLD.status, NEW.status;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS on_order_status_update ON orders;

-- Create trigger that fires AFTER update
CREATE TRIGGER on_order_status_update
  AFTER UPDATE ON orders
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION queue_order_status_sync();

-- Add indexes for Returns Not Received query performance
-- Orders marked returned by courier (dispatch status) but still dispatched in Ecomnet (order status)
CREATE INDEX IF NOT EXISTS idx_orders_status_dispatched 
  ON orders(status) 
  WHERE status = 'dispatched';

-- Add columns for confirmation and booking tracking if they don't exist
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'booked_at') THEN
    ALTER TABLE orders ADD COLUMN booked_at TIMESTAMP WITH TIME ZONE;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'booked_by') THEN
    ALTER TABLE orders ADD COLUMN booked_by UUID REFERENCES profiles(id);
  END IF;
END $$;