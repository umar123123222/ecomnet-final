-- Create a table to log failed order updates for debugging
CREATE TABLE IF NOT EXISTS order_update_failures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  attempted_update JSONB NOT NULL,
  error_message TEXT,
  error_code TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add index for efficient querying
CREATE INDEX IF NOT EXISTS idx_order_update_failures_order_id ON order_update_failures(order_id);
CREATE INDEX IF NOT EXISTS idx_order_update_failures_created_at ON order_update_failures(created_at DESC);

-- Enable RLS
ALTER TABLE order_update_failures ENABLE ROW LEVEL SECURITY;

-- System can insert update failures (from edge functions)
CREATE POLICY "System can insert update failures" ON order_update_failures
  FOR INSERT WITH CHECK (true);

-- Authenticated users can view failures
CREATE POLICY "Authenticated users can view failures" ON order_update_failures
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- Managers can delete old failures (cleanup)
CREATE POLICY "Managers can delete failures" ON order_update_failures
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role IN ('super_admin', 'super_manager')
      AND user_roles.is_active = true
    )
  );