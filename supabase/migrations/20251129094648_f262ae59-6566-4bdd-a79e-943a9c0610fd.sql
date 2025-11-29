-- Add is_bundle column to products table
ALTER TABLE products ADD COLUMN is_bundle BOOLEAN DEFAULT false;

-- Create product_bundle_items table
CREATE TABLE product_bundle_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bundle_product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  component_product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL DEFAULT 1,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(bundle_product_id, component_product_id)
);

-- Enable RLS
ALTER TABLE product_bundle_items ENABLE ROW LEVEL SECURITY;

-- Create policies for authenticated users
CREATE POLICY "Authenticated users can view bundle items"
  ON product_bundle_items FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can manage bundle items"
  ON product_bundle_items FOR ALL TO authenticated USING (true);

-- Add trigger for updated_at
CREATE TRIGGER update_product_bundle_items_updated_at
  BEFORE UPDATE ON product_bundle_items
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();