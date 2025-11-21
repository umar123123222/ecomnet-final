-- Step 2: Now that 'confirmed' enum value exists, migrate data and clean up

-- Migrate existing data: orders with confirmation_status='confirmed' should have status='confirmed'
UPDATE orders 
SET status = 'confirmed'::order_status
WHERE confirmation_status = 'confirmed' 
  AND status = 'pending';

-- Drop the trigger that updates confirmation_status
DROP TRIGGER IF EXISTS trigger_update_order_confirmation_status ON order_confirmations;

-- Drop the function that updates confirmation_status
DROP FUNCTION IF EXISTS update_order_confirmation_status();

-- Update the create_order_confirmation function to not set confirmation_status
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

-- Drop the confirmation_status column
ALTER TABLE orders DROP COLUMN IF EXISTS confirmation_status;

-- Drop the confirmation_deadline column (no longer needed)
ALTER TABLE orders DROP COLUMN IF EXISTS confirmation_deadline;

-- Drop the confirmed_at column (we can use activity logs for this)
ALTER TABLE orders DROP COLUMN IF EXISTS confirmed_at;

-- Drop the confirmed_by column (we can use activity logs for this)
ALTER TABLE orders DROP COLUMN IF EXISTS confirmed_by;

-- Update queue_order_status_sync to handle 'confirmed' status
CREATE OR REPLACE FUNCTION queue_order_status_sync()
RETURNS TRIGGER AS $$
DECLARE
  v_priority TEXT := 'normal';
BEGIN
  -- Only queue sync if order has shopify_order_id OR if it's a status that should be synced
  IF (OLD.status IS DISTINCT FROM NEW.status) AND 
     (NEW.status IN ('confirmed', 'booked', 'dispatched', 'delivered', 'returned', 'cancelled')) THEN
    
    -- Set priority based on status
    IF NEW.status IN ('delivered', 'returned', 'cancelled') THEN
      v_priority := 'high';
    ELSIF NEW.status IN ('confirmed', 'booked') THEN
      v_priority := 'high';
    ELSIF NEW.status = 'dispatched' THEN
      v_priority := 'normal';
    END IF;
    
    -- Insert into sync queue with priority
    INSERT INTO sync_queue (entity_type, entity_id, action, direction, payload, status, priority)
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
      'pending',
      v_priority
    )
    ON CONFLICT DO NOTHING;
    
    RAISE NOTICE 'Queued status sync for order % with priority %: % -> %', NEW.order_number, v_priority, OLD.status, NEW.status;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;