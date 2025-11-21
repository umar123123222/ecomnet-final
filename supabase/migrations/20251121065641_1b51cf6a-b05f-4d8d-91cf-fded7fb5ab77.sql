-- Add priority levels to sync_queue
ALTER TABLE sync_queue ADD COLUMN IF NOT EXISTS priority TEXT DEFAULT 'normal' CHECK (priority IN ('critical', 'high', 'normal', 'low'));

-- Add index for priority-based processing
CREATE INDEX IF NOT EXISTS idx_sync_queue_priority_status 
  ON sync_queue(priority DESC, created_at DESC) 
  WHERE status = 'pending';

-- Create sync_conflicts table for conflict resolution
CREATE TABLE IF NOT EXISTS sync_conflicts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type TEXT NOT NULL,
  entity_id UUID NOT NULL,
  shopify_data JSONB NOT NULL,
  ecomnet_data JSONB NOT NULL,
  conflict_type TEXT NOT NULL,
  resolution_status TEXT DEFAULT 'pending' CHECK (resolution_status IN ('pending', 'resolved', 'ignored')),
  resolved_at TIMESTAMP WITH TIME ZONE,
  resolved_by UUID REFERENCES profiles(id),
  resolution_notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS on sync_conflicts
ALTER TABLE sync_conflicts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Managers can view sync conflicts" ON sync_conflicts
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
      AND role IN ('super_admin', 'super_manager')
      AND is_active = true
    )
  );

CREATE POLICY "Managers can update sync conflicts" ON sync_conflicts
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
      AND role IN ('super_admin', 'super_manager')
      AND is_active = true
    )
  );

-- Create automated_alerts table
CREATE TABLE IF NOT EXISTS automated_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_type TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID NOT NULL,
  severity TEXT DEFAULT 'medium' CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'acknowledged', 'resolved', 'ignored')),
  acknowledged_at TIMESTAMP WITH TIME ZONE,
  acknowledged_by UUID REFERENCES profiles(id),
  resolved_at TIMESTAMP WITH TIME ZONE,
  resolved_by UUID REFERENCES profiles(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS on automated_alerts
ALTER TABLE automated_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view alerts" ON automated_alerts
  FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Users can update their alerts" ON automated_alerts
  FOR UPDATE
  USING (auth.uid() IS NOT NULL);

-- Create index for alert queries
CREATE INDEX IF NOT EXISTS idx_automated_alerts_status 
  ON automated_alerts(status, severity DESC, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_automated_alerts_entity 
  ON automated_alerts(entity_type, entity_id);

-- Update queue_order_status_sync to set priority based on status
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