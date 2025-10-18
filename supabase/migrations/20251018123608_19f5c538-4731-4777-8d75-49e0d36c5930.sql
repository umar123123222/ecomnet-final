-- Phase 1: Barcode Printing & Production Tracking System
-- Add product type and barcode fields
ALTER TABLE products ADD COLUMN IF NOT EXISTS product_type text DEFAULT 'finished' CHECK (product_type IN ('raw_material', 'finished', 'both'));
ALTER TABLE products ADD COLUMN IF NOT EXISTS barcode text;
ALTER TABLE products ADD COLUMN IF NOT EXISTS barcode_format text DEFAULT 'CODE128';
ALTER TABLE packaging_items ADD COLUMN IF NOT EXISTS barcode text;
ALTER TABLE packaging_items ADD COLUMN IF NOT EXISTS barcode_format text DEFAULT 'CODE128';

-- Create unique index on barcodes where not null
CREATE UNIQUE INDEX IF NOT EXISTS products_barcode_unique ON products(barcode) WHERE barcode IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS packaging_items_barcode_unique ON packaging_items(barcode) WHERE barcode IS NOT NULL;

-- Bill of Materials table
CREATE TABLE IF NOT EXISTS bill_of_materials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  finished_product_id uuid REFERENCES products(id) ON DELETE CASCADE NOT NULL,
  raw_material_id uuid REFERENCES products(id) ON DELETE RESTRICT,
  packaging_item_id uuid REFERENCES packaging_items(id) ON DELETE RESTRICT,
  quantity_required numeric NOT NULL CHECK (quantity_required > 0),
  unit text NOT NULL,
  notes text,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT bom_material_check CHECK (
    (raw_material_id IS NOT NULL AND packaging_item_id IS NULL) OR
    (raw_material_id IS NULL AND packaging_item_id IS NOT NULL)
  )
);

-- Production batches table
CREATE TABLE IF NOT EXISTS production_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_number text UNIQUE NOT NULL,
  finished_product_id uuid REFERENCES products(id) ON DELETE RESTRICT NOT NULL,
  outlet_id uuid REFERENCES outlets(id) ON DELETE RESTRICT NOT NULL,
  quantity_produced integer NOT NULL CHECK (quantity_produced > 0),
  production_date date NOT NULL DEFAULT CURRENT_DATE,
  expiry_date date,
  produced_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  status text DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'completed', 'cancelled')),
  notes text,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  completed_at timestamptz,
  CONSTRAINT valid_expiry_date CHECK (expiry_date IS NULL OR expiry_date > production_date)
);

-- Production material usage table
CREATE TABLE IF NOT EXISTS production_material_usage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  production_batch_id uuid REFERENCES production_batches(id) ON DELETE CASCADE NOT NULL,
  raw_material_id uuid REFERENCES products(id) ON DELETE RESTRICT,
  packaging_item_id uuid REFERENCES packaging_items(id) ON DELETE RESTRICT,
  quantity_used numeric NOT NULL CHECK (quantity_used > 0),
  created_at timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT usage_material_check CHECK (
    (raw_material_id IS NOT NULL AND packaging_item_id IS NULL) OR
    (raw_material_id IS NULL AND packaging_item_id IS NOT NULL)
  )
);

-- Label print logs table
CREATE TABLE IF NOT EXISTS label_print_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  label_type text NOT NULL CHECK (label_type IN ('raw_material', 'finished_product', 'packaging')),
  product_id uuid REFERENCES products(id) ON DELETE SET NULL,
  packaging_item_id uuid REFERENCES packaging_items(id) ON DELETE SET NULL,
  production_batch_id uuid REFERENCES production_batches(id) ON DELETE SET NULL,
  quantity_printed integer NOT NULL CHECK (quantity_printed > 0),
  label_data jsonb NOT NULL,
  printed_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  printed_at timestamptz DEFAULT now() NOT NULL,
  print_format text DEFAULT 'PDF',
  notes text
);

-- Add production movement types to stock_movements
DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'stock_movements' AND column_name = 'movement_type'
  ) THEN
    ALTER TABLE stock_movements DROP CONSTRAINT IF EXISTS stock_movements_movement_type_check;
    ALTER TABLE stock_movements ADD CONSTRAINT stock_movements_movement_type_check 
      CHECK (movement_type IN ('sale', 'purchase', 'adjustment', 'transfer_in', 'transfer_out', 'return', 'production_in', 'production_out'));
  END IF;
END $$;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_bom_finished_product ON bill_of_materials(finished_product_id);
CREATE INDEX IF NOT EXISTS idx_bom_raw_material ON bill_of_materials(raw_material_id) WHERE raw_material_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_bom_packaging ON bill_of_materials(packaging_item_id) WHERE packaging_item_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_production_batches_status ON production_batches(status);
CREATE INDEX IF NOT EXISTS idx_production_batches_date ON production_batches(production_date DESC);
CREATE INDEX IF NOT EXISTS idx_production_usage_batch ON production_material_usage(production_batch_id);
CREATE INDEX IF NOT EXISTS idx_label_logs_printed_at ON label_print_logs(printed_at DESC);

-- Enable RLS on new tables
ALTER TABLE bill_of_materials ENABLE ROW LEVEL SECURITY;
ALTER TABLE production_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE production_material_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE label_print_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies for Bill of Materials
CREATE POLICY "Authenticated users can view BOM" ON bill_of_materials 
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Managers can manage BOM" ON bill_of_materials 
  FOR ALL USING (is_manager(auth.uid()));

-- RLS Policies for Production Batches
CREATE POLICY "Staff can view production batches" ON production_batches 
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Staff can create production batches" ON production_batches 
  FOR INSERT WITH CHECK (produced_by = auth.uid());

CREATE POLICY "Staff can update their own batches" ON production_batches 
  FOR UPDATE USING (produced_by = auth.uid());

CREATE POLICY "Managers can manage all production batches" ON production_batches 
  FOR ALL USING (is_manager(auth.uid()));

-- RLS Policies for Production Material Usage
CREATE POLICY "Staff can view material usage" ON production_material_usage 
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "System can record material usage" ON production_material_usage 
  FOR INSERT WITH CHECK (true);

-- RLS Policies for Label Print Logs
CREATE POLICY "Staff can view print logs" ON label_print_logs 
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Staff can create print logs" ON label_print_logs 
  FOR INSERT WITH CHECK (printed_by = auth.uid());

-- Update trigger for bill_of_materials
CREATE OR REPLACE FUNCTION update_bom_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER update_bom_updated_at_trigger
  BEFORE UPDATE ON bill_of_materials
  FOR EACH ROW
  EXECUTE FUNCTION update_bom_updated_at();

-- Update trigger for production_batches
CREATE TRIGGER update_production_batches_updated_at_trigger
  BEFORE UPDATE ON production_batches
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();