-- Phase 1: Update PO Status Constraint and Add Payment Columns

-- Drop existing status constraint and add updated one with all statuses
ALTER TABLE purchase_orders DROP CONSTRAINT IF EXISTS purchase_orders_status_check;
ALTER TABLE purchase_orders ADD CONSTRAINT purchase_orders_status_check 
  CHECK (status IN ('pending', 'draft', 'sent', 'confirmed', 'supplier_rejected', 'in_transit', 'partially_received', 'completed', 'cancelled'));

-- Add payment tracking columns
ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS paid_amount NUMERIC DEFAULT 0;
ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS payment_date TIMESTAMP WITH TIME ZONE;
ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS payment_reference TEXT;
ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS payment_notes TEXT;

-- Update existing 'draft' status to 'pending'
UPDATE purchase_orders SET status = 'pending' WHERE status = 'draft';

-- Create credit notes table for discrepancies
CREATE TABLE IF NOT EXISTS supplier_credit_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  po_id UUID REFERENCES purchase_orders(id) ON DELETE CASCADE,
  grn_id UUID REFERENCES goods_received_notes(id) ON DELETE SET NULL,
  supplier_id UUID REFERENCES suppliers(id) ON DELETE CASCADE NOT NULL,
  amount NUMERIC NOT NULL,
  reason TEXT NOT NULL,
  item_details JSONB,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'applied')),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  resolved_at TIMESTAMP WITH TIME ZONE,
  resolved_by UUID REFERENCES auth.users(id)
);

-- Enable RLS on credit notes
ALTER TABLE supplier_credit_notes ENABLE ROW LEVEL SECURITY;

-- RLS policies for credit notes
CREATE POLICY "Super admins and managers can view all credit notes"
  ON supplier_credit_notes FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
      AND role IN ('super_admin', 'super_manager', 'warehouse_manager')
      AND is_active = true
    )
  );

CREATE POLICY "Suppliers can view their own credit notes"
  ON supplier_credit_notes FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM supplier_profiles
      WHERE user_id = auth.uid()
      AND supplier_id = supplier_credit_notes.supplier_id
    )
  );

CREATE POLICY "Super admins and managers can manage credit notes"
  ON supplier_credit_notes FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
      AND role IN ('super_admin', 'super_manager')
      AND is_active = true
    )
  );

-- Add index for performance
CREATE INDEX IF NOT EXISTS idx_credit_notes_po_id ON supplier_credit_notes(po_id);
CREATE INDEX IF NOT EXISTS idx_credit_notes_supplier_id ON supplier_credit_notes(supplier_id);
CREATE INDEX IF NOT EXISTS idx_credit_notes_status ON supplier_credit_notes(status);

-- Add index on purchase_orders for status queries
CREATE INDEX IF NOT EXISTS idx_purchase_orders_status ON purchase_orders(status);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_payment_status ON purchase_orders(payment_status);