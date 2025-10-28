-- Add smart reordering fields to products
ALTER TABLE products
ADD COLUMN IF NOT EXISTS lead_time_days integer DEFAULT 7,
ADD COLUMN IF NOT EXISTS safety_stock_level integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS avg_daily_sales numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS sales_velocity_updated_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS auto_reorder_enabled boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS preferred_supplier_id uuid REFERENCES suppliers(id);

-- Add smart reordering fields to packaging_items
ALTER TABLE packaging_items
ADD COLUMN IF NOT EXISTS lead_time_days integer DEFAULT 7,
ADD COLUMN IF NOT EXISTS safety_stock_level integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS avg_daily_usage numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS usage_velocity_updated_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS auto_reorder_enabled boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS preferred_supplier_id uuid REFERENCES suppliers(id);

-- Create sales velocity tracking table
CREATE TABLE IF NOT EXISTS sales_velocity_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid REFERENCES products(id) ON DELETE CASCADE,
  packaging_item_id uuid REFERENCES packaging_items(id) ON DELETE CASCADE,
  date date NOT NULL,
  quantity_sold integer NOT NULL DEFAULT 0,
  quantity_used integer NOT NULL DEFAULT 0,
  outlet_id uuid REFERENCES outlets(id),
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT product_or_packaging_check CHECK (
    (product_id IS NOT NULL AND packaging_item_id IS NULL) OR
    (product_id IS NULL AND packaging_item_id IS NOT NULL)
  )
);

-- Create auto-generated purchase orders table
CREATE TABLE IF NOT EXISTS auto_purchase_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  po_id uuid REFERENCES purchase_orders(id) ON DELETE CASCADE,
  trigger_reason text NOT NULL,
  recommended_quantity integer NOT NULL,
  calculated_reorder_point integer NOT NULL,
  current_stock integer NOT NULL,
  avg_daily_consumption numeric NOT NULL,
  lead_time_days integer NOT NULL,
  auto_approved boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  created_by uuid REFERENCES profiles(id),
  metadata jsonb DEFAULT '{}'::jsonb
);

-- Create indexes for performance
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_sales_velocity_product') THEN
    CREATE INDEX idx_sales_velocity_product ON sales_velocity_history(product_id, date DESC);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_sales_velocity_packaging') THEN
    CREATE INDEX idx_sales_velocity_packaging ON sales_velocity_history(packaging_item_id, date DESC);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_sales_velocity_date') THEN
    CREATE INDEX idx_sales_velocity_date ON sales_velocity_history(date DESC);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_auto_po_created') THEN
    CREATE INDEX idx_auto_po_created ON auto_purchase_orders(created_at DESC);
  END IF;
END $$;

-- Enable RLS
ALTER TABLE sales_velocity_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE auto_purchase_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE supplier_performance ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Authenticated users can view sales velocity" ON sales_velocity_history;
DROP POLICY IF EXISTS "System can insert sales velocity" ON sales_velocity_history;
DROP POLICY IF EXISTS "Managers can view auto POs" ON auto_purchase_orders;
DROP POLICY IF EXISTS "System can create auto POs" ON auto_purchase_orders;
DROP POLICY IF EXISTS "Managers can update auto POs" ON auto_purchase_orders;
DROP POLICY IF EXISTS "Authenticated users can view supplier performance" ON supplier_performance;
DROP POLICY IF EXISTS "System can insert supplier performance" ON supplier_performance;
DROP POLICY IF EXISTS "Managers can update supplier performance" ON supplier_performance;

-- RLS Policies for sales_velocity_history
CREATE POLICY "Authenticated users can view sales velocity"
  ON sales_velocity_history FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "System can insert sales velocity"
  ON sales_velocity_history FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- RLS Policies for auto_purchase_orders
CREATE POLICY "Managers can view auto POs"
  ON auto_purchase_orders FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
      AND role IN ('super_admin', 'super_manager', 'warehouse_manager')
      AND is_active = true
    )
  );

CREATE POLICY "System can create auto POs"
  ON auto_purchase_orders FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Managers can update auto POs"
  ON auto_purchase_orders FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
      AND role IN ('super_admin', 'super_manager', 'warehouse_manager')
      AND is_active = true
    )
  );

-- RLS Policies for supplier_performance
CREATE POLICY "Authenticated users can view supplier performance"
  ON supplier_performance FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "System can insert supplier performance"
  ON supplier_performance FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Managers can update supplier performance"
  ON supplier_performance FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
      AND role IN ('super_admin', 'super_manager', 'warehouse_manager')
      AND is_active = true
    )
  );

-- Function to calculate optimal reorder quantity
CREATE OR REPLACE FUNCTION calculate_reorder_quantity(
  p_avg_daily_sales numeric,
  p_lead_time_days integer,
  p_safety_stock integer,
  p_current_stock integer
) RETURNS integer
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_reorder_point integer;
  v_optimal_quantity integer;
BEGIN
  v_reorder_point := CEIL((p_avg_daily_sales * p_lead_time_days) + p_safety_stock);
  v_optimal_quantity := GREATEST(v_reorder_point * 2, 1);
  
  IF p_current_stock >= v_reorder_point THEN
    RETURN 0;
  END IF;
  
  RETURN v_optimal_quantity - p_current_stock;
END;
$$;