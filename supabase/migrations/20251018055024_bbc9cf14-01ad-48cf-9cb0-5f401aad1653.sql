-- Order Confirmation System Database Schema

-- Table for tracking order confirmations
CREATE TABLE order_confirmations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES customers(id),
  confirmation_type TEXT NOT NULL CHECK (confirmation_type IN ('order', 'address', 'dispatch', 'delivery')),
  sent_at TIMESTAMP WITH TIME ZONE,
  sent_via TEXT CHECK (sent_via IN ('whatsapp', 'sms', 'email', 'call')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'delivered', 'read', 'confirmed', 'cancelled', 'failed', 'expired')),
  customer_response TEXT CHECK (customer_response IN ('confirmed', 'cancelled', 'modified', 'no_response')),
  response_at TIMESTAMP WITH TIME ZONE,
  retry_count INTEGER DEFAULT 0,
  retry_scheduled_at TIMESTAMP WITH TIME ZONE,
  message_content TEXT,
  message_id TEXT,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX idx_order_confirmations_order_id ON order_confirmations(order_id);
CREATE INDEX idx_order_confirmations_customer_id ON order_confirmations(customer_id);
CREATE INDEX idx_order_confirmations_status ON order_confirmations(status);
CREATE INDEX idx_order_confirmations_retry_scheduled ON order_confirmations(retry_scheduled_at) WHERE status = 'failed';

-- Add confirmation fields to orders table
ALTER TABLE orders ADD COLUMN IF NOT EXISTS confirmation_required BOOLEAN DEFAULT true;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS confirmation_status TEXT CHECK (confirmation_status IN ('pending', 'confirmed', 'cancelled', 'expired'));
ALTER TABLE orders ADD COLUMN IF NOT EXISTS confirmed_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS confirmed_by TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS confirmation_deadline TIMESTAMP WITH TIME ZONE;

-- Enable RLS
ALTER TABLE order_confirmations ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Authenticated users can view confirmations"
ON order_confirmations FOR SELECT
TO authenticated
USING (auth.uid() IS NOT NULL);

CREATE POLICY "System can create confirmations"
ON order_confirmations FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "System can update confirmations"
ON order_confirmations FOR UPDATE
TO authenticated
USING (true);

CREATE POLICY "Managers can delete confirmations"
ON order_confirmations FOR DELETE
TO authenticated
USING (is_manager(auth.uid()));

-- Function to auto-schedule order confirmation
CREATE OR REPLACE FUNCTION schedule_order_confirmation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only schedule if confirmation is required
  IF NEW.confirmation_required = true AND NEW.confirmation_status IS NULL THEN
    -- Set confirmation deadline to 48 hours from order creation
    NEW.confirmation_deadline := NEW.created_at + INTERVAL '48 hours';
    NEW.confirmation_status := 'pending';
    
    -- Create initial confirmation record
    INSERT INTO order_confirmations (
      order_id,
      customer_id,
      confirmation_type,
      status,
      retry_scheduled_at
    ) VALUES (
      NEW.id,
      NEW.customer_id,
      'order',
      'pending',
      NEW.created_at + INTERVAL '2 hours' -- Schedule first attempt in 2 hours
    );
  END IF;
  
  RETURN NEW;
END;
$$;

-- Trigger to auto-schedule confirmations on order creation
CREATE TRIGGER trigger_schedule_order_confirmation
BEFORE INSERT ON orders
FOR EACH ROW
EXECUTE FUNCTION schedule_order_confirmation();

-- Function to update order confirmation status
CREATE OR REPLACE FUNCTION update_order_confirmation_status()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Update order status based on confirmation response
  IF NEW.customer_response = 'confirmed' AND OLD.customer_response IS DISTINCT FROM 'confirmed' THEN
    UPDATE orders 
    SET 
      confirmation_status = 'confirmed',
      confirmed_at = NEW.response_at,
      confirmed_by = 'customer'
    WHERE id = NEW.order_id;
  ELSIF NEW.customer_response = 'cancelled' AND OLD.customer_response IS DISTINCT FROM 'cancelled' THEN
    UPDATE orders 
    SET 
      confirmation_status = 'cancelled',
      status = 'cancelled'
    WHERE id = NEW.order_id;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Trigger to update order when confirmation response received
CREATE TRIGGER trigger_update_order_confirmation_status
AFTER UPDATE OF customer_response ON order_confirmations
FOR EACH ROW
EXECUTE FUNCTION update_order_confirmation_status();

-- Function to mark expired confirmations
CREATE OR REPLACE FUNCTION mark_expired_confirmations()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  rows_updated INTEGER;
BEGIN
  -- Mark confirmations as expired if deadline passed and no response
  UPDATE order_confirmations
  SET 
    status = 'expired',
    updated_at = now()
  WHERE status IN ('pending', 'sent', 'delivered', 'read', 'failed')
    AND EXISTS (
      SELECT 1 FROM orders 
      WHERE orders.id = order_confirmations.order_id 
      AND orders.confirmation_deadline < now()
    );
  
  GET DIAGNOSTICS rows_updated = ROW_COUNT;
  
  -- Also update order status
  UPDATE orders
  SET confirmation_status = 'expired'
  WHERE confirmation_deadline < now()
    AND confirmation_status = 'pending';
  
  RETURN rows_updated;
END;
$$;