-- Enhance couriers table with flexible API configuration
ALTER TABLE couriers
ADD COLUMN IF NOT EXISTS auth_type text DEFAULT 'bearer_token' CHECK (auth_type IN ('bearer_token', 'api_key_header', 'basic_auth', 'custom')),
ADD COLUMN IF NOT EXISTS auth_config jsonb DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS booking_endpoint text,
ADD COLUMN IF NOT EXISTS tracking_endpoint text,
ADD COLUMN IF NOT EXISTS label_endpoint text,
ADD COLUMN IF NOT EXISTS label_format text DEFAULT 'pdf' CHECK (label_format IN ('pdf', 'html', 'png', 'url')),
ADD COLUMN IF NOT EXISTS label_config jsonb DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS auto_download_label boolean DEFAULT true;

-- Create courier tracking history table
CREATE TABLE IF NOT EXISTS courier_tracking_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dispatch_id uuid NOT NULL REFERENCES dispatches(id) ON DELETE CASCADE,
  order_id uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  courier_id uuid NOT NULL REFERENCES couriers(id) ON DELETE CASCADE,
  tracking_id text NOT NULL,
  status text NOT NULL,
  current_location text,
  checked_at timestamp with time zone NOT NULL DEFAULT now(),
  raw_response jsonb,
  created_at timestamp with time zone DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tracking_history_dispatch ON courier_tracking_history(dispatch_id);
CREATE INDEX IF NOT EXISTS idx_tracking_history_order ON courier_tracking_history(order_id);
CREATE INDEX IF NOT EXISTS idx_tracking_history_checked_at ON courier_tracking_history(checked_at);

-- Enable RLS
ALTER TABLE courier_tracking_history ENABLE ROW LEVEL SECURITY;

-- RLS Policies for tracking history
CREATE POLICY "Authenticated users can view tracking history"
  ON courier_tracking_history FOR SELECT
  TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "System can insert tracking history"
  ON courier_tracking_history FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Add label_url to dispatches table
ALTER TABLE dispatches
ADD COLUMN IF NOT EXISTS label_url text,
ADD COLUMN IF NOT EXISTS label_data text,
ADD COLUMN IF NOT EXISTS label_format text;