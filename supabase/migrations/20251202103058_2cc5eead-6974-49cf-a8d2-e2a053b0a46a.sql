-- Create transfer_receipts table
CREATE TABLE IF NOT EXISTS transfer_receipts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transfer_id UUID NOT NULL REFERENCES stock_transfer_requests(id) ON DELETE CASCADE,
  received_by UUID NOT NULL REFERENCES auth.users(id),
  received_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create transfer_receipt_items table
CREATE TABLE IF NOT EXISTS transfer_receipt_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  receipt_id UUID NOT NULL REFERENCES transfer_receipts(id) ON DELETE CASCADE,
  transfer_item_id UUID NOT NULL REFERENCES stock_transfer_items(id),
  quantity_expected INTEGER NOT NULL,
  quantity_received INTEGER NOT NULL,
  variance INTEGER GENERATED ALWAYS AS (quantity_expected - quantity_received) STORED,
  variance_reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create transfer_variances table
CREATE TABLE IF NOT EXISTS transfer_variances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transfer_id UUID NOT NULL REFERENCES stock_transfer_requests(id),
  transfer_item_id UUID NOT NULL REFERENCES stock_transfer_items(id),
  product_id UUID NOT NULL REFERENCES products(id),
  outlet_id UUID NOT NULL REFERENCES outlets(id),
  expected_quantity INTEGER NOT NULL,
  received_quantity INTEGER NOT NULL,
  variance INTEGER NOT NULL,
  variance_value NUMERIC NOT NULL DEFAULT 0,
  severity TEXT CHECK (severity IN ('low', 'medium', 'high', 'critical')) DEFAULT 'medium',
  status TEXT CHECK (status IN ('open', 'investigating', 'resolved')) DEFAULT 'open',
  reported_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  resolved_at TIMESTAMP WITH TIME ZONE,
  resolution_notes TEXT
);

-- Enable RLS
ALTER TABLE transfer_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE transfer_receipt_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE transfer_variances ENABLE ROW LEVEL SECURITY;

-- RLS Policies for transfer_receipts
CREATE POLICY "Authenticated users can view receipts"
  ON transfer_receipts FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Store managers can create receipts for their outlet"
  ON transfer_receipts FOR INSERT
  TO authenticated
  WITH CHECK (
    received_by = auth.uid() AND
    EXISTS (
      SELECT 1 FROM stock_transfer_requests str
      WHERE str.id = transfer_id
      AND str.to_outlet_id IN (
        SELECT outlet_id FROM outlet_staff WHERE user_id = auth.uid()
        UNION
        SELECT id FROM outlets WHERE manager_id = auth.uid()
      )
    )
  );

-- RLS Policies for transfer_receipt_items
CREATE POLICY "Authenticated users can view receipt items"
  ON transfer_receipt_items FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "System can manage receipt items"
  ON transfer_receipt_items FOR ALL
  TO authenticated
  USING (true);

-- RLS Policies for transfer_variances
CREATE POLICY "Managers can view all variances"
  ON transfer_variances FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
      AND role IN ('super_admin', 'super_manager', 'warehouse_manager')
      AND is_active = true
    )
  );

CREATE POLICY "Store managers can view their outlet variances"
  ON transfer_variances FOR SELECT
  TO authenticated
  USING (
    outlet_id IN (
      SELECT outlet_id FROM outlet_staff WHERE user_id = auth.uid()
      UNION
      SELECT id FROM outlets WHERE manager_id = auth.uid()
    )
  );

CREATE POLICY "System can create variances"
  ON transfer_variances FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Managers can update variances"
  ON transfer_variances FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
      AND role IN ('super_admin', 'super_manager', 'warehouse_manager')
      AND is_active = true
    )
  );

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_transfer_receipts_transfer_id ON transfer_receipts(transfer_id);
CREATE INDEX IF NOT EXISTS idx_transfer_receipt_items_receipt_id ON transfer_receipt_items(receipt_id);
CREATE INDEX IF NOT EXISTS idx_transfer_variances_transfer_id ON transfer_variances(transfer_id);
CREATE INDEX IF NOT EXISTS idx_transfer_variances_status ON transfer_variances(status);
CREATE INDEX IF NOT EXISTS idx_transfer_variances_outlet_id ON transfer_variances(outlet_id);