-- Create scan_results table to store all scan data
CREATE TABLE scan_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scan_type text NOT NULL CHECK (scan_type IN ('dispatch', 'return')),
  order_id text,
  tracking_id text,
  raw_data text NOT NULL,
  scan_mode text NOT NULL CHECK (scan_mode IN ('qr', 'ocr', 'barcode')),
  scanned_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE scan_results ENABLE ROW LEVEL SECURITY;

-- Policy: Users can insert their own scans
CREATE POLICY "Users can insert scans"
  ON scan_results FOR INSERT
  WITH CHECK (auth.uid() = scanned_by);

-- Policy: Users can view their own scans
CREATE POLICY "Users can view own scans"
  ON scan_results FOR SELECT
  USING (auth.uid() = scanned_by);

-- Policy: Admins can view all scans
CREATE POLICY "Admins can view all scans"
  ON scan_results FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('super_admin', 'super_manager')
    )
  );

-- Add indexes for performance
CREATE INDEX idx_scan_results_created_at ON scan_results(created_at DESC);
CREATE INDEX idx_scan_results_scanned_by ON scan_results(scanned_by);
CREATE INDEX idx_scan_results_order_id ON scan_results(order_id);
CREATE INDEX idx_scan_results_tracking_id ON scan_results(tracking_id);