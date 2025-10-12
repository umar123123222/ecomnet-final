-- ============================================
-- PHASE 2: PHYSICAL STOCK VERIFICATION
-- ============================================

-- Create Stock Count Schedules Table
CREATE TABLE stock_count_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  outlet_id UUID REFERENCES outlets(id) NOT NULL,
  count_type TEXT NOT NULL CHECK (count_type IN ('full', 'cycle', 'spot')),
  frequency TEXT CHECK (frequency IN ('daily', 'weekly', 'monthly', 'quarterly', 'annual')),
  next_count_date DATE,
  assigned_to UUID REFERENCES profiles(id),
  status TEXT DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'in_progress', 'completed', 'cancelled')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create Stock Counts Table (audit sessions)
CREATE TABLE stock_counts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  count_number TEXT UNIQUE NOT NULL,
  outlet_id UUID REFERENCES outlets(id) NOT NULL,
  count_type TEXT NOT NULL CHECK (count_type IN ('full', 'cycle', 'spot', 'unscheduled')),
  status TEXT DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'completed', 'approved', 'rejected')),
  started_by UUID REFERENCES profiles(id) NOT NULL,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  approved_by UUID REFERENCES profiles(id),
  approved_at TIMESTAMPTZ,
  total_items_counted INTEGER DEFAULT 0,
  items_with_variance INTEGER DEFAULT 0,
  total_variance_value DECIMAL(15,2) DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create Stock Count Items Table
CREATE TABLE stock_count_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  count_id UUID REFERENCES stock_counts(id) ON DELETE CASCADE NOT NULL,
  product_id UUID REFERENCES products(id) NOT NULL,
  outlet_id UUID REFERENCES outlets(id) NOT NULL,
  system_quantity INTEGER NOT NULL,
  counted_quantity INTEGER NOT NULL,
  variance INTEGER,
  variance_percentage DECIMAL(5,2),
  unit_cost DECIMAL(10,2),
  variance_value DECIMAL(12,2),
  counted_by UUID REFERENCES profiles(id) NOT NULL,
  counted_at TIMESTAMPTZ DEFAULT NOW(),
  recount_required BOOLEAN DEFAULT FALSE,
  recount_count INTEGER DEFAULT 0,
  notes TEXT,
  variance_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create Count Variances Table
CREATE TABLE count_variances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  count_item_id UUID REFERENCES stock_count_items(id) NOT NULL,
  product_id UUID REFERENCES products(id) NOT NULL,
  outlet_id UUID REFERENCES outlets(id) NOT NULL,
  variance INTEGER NOT NULL,
  variance_value DECIMAL(12,2) NOT NULL,
  severity TEXT CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  status TEXT DEFAULT 'open' CHECK (status IN ('open', 'investigating', 'resolved', 'write_off')),
  assigned_to UUID REFERENCES profiles(id),
  root_cause TEXT,
  corrective_action TEXT,
  resolved_by UUID REFERENCES profiles(id),
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create Indexes
CREATE INDEX idx_count_schedules_outlet ON stock_count_schedules(outlet_id);
CREATE INDEX idx_count_schedules_status ON stock_count_schedules(status);
CREATE INDEX idx_stock_counts_outlet ON stock_counts(outlet_id);
CREATE INDEX idx_stock_counts_status ON stock_counts(status);
CREATE INDEX idx_stock_counts_date ON stock_counts(started_at);
CREATE INDEX idx_count_items_count ON stock_count_items(count_id);
CREATE INDEX idx_count_items_product ON stock_count_items(product_id);
CREATE INDEX idx_count_variances_status ON count_variances(status);
CREATE INDEX idx_count_variances_severity ON count_variances(severity);

-- Enable RLS
ALTER TABLE stock_count_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_counts ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_count_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE count_variances ENABLE ROW LEVEL SECURITY;

-- RLS Policies for Stock Count Schedules
CREATE POLICY "Authenticated users can view schedules" 
ON stock_count_schedules FOR SELECT 
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Managers can manage schedules" 
ON stock_count_schedules FOR ALL 
USING (
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = auth.uid() 
    AND role IN ('super_admin', 'super_manager', 'warehouse_manager')
  )
);

-- RLS Policies for Stock Counts
CREATE POLICY "Authenticated users can view counts" 
ON stock_counts FOR SELECT 
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Staff can create counts" 
ON stock_counts FOR INSERT 
WITH CHECK (auth.uid() = started_by);

CREATE POLICY "Managers can manage counts" 
ON stock_counts FOR ALL 
USING (
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = auth.uid() 
    AND role IN ('super_admin', 'super_manager', 'warehouse_manager')
  )
);

-- RLS Policies for Count Items
CREATE POLICY "Authenticated users can view count items" 
ON stock_count_items FOR SELECT 
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Staff can create count items" 
ON stock_count_items FOR INSERT 
WITH CHECK (auth.uid() = counted_by);

CREATE POLICY "Staff can update their count items" 
ON stock_count_items FOR UPDATE 
USING (auth.uid() = counted_by);

-- RLS Policies for Variances
CREATE POLICY "Authenticated users can view variances" 
ON count_variances FOR SELECT 
USING (auth.uid() IS NOT NULL);

CREATE POLICY "System can create variances" 
ON count_variances FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Managers can manage variances" 
ON count_variances FOR ALL 
USING (
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = auth.uid() 
    AND role IN ('super_admin', 'super_manager', 'warehouse_manager')
  )
);

-- Function to calculate variance severity
CREATE OR REPLACE FUNCTION calculate_variance_severity(variance_value DECIMAL)
RETURNS TEXT AS $$
BEGIN
  IF ABS(variance_value) > 10000 THEN RETURN 'critical';
  ELSIF ABS(variance_value) > 5000 THEN RETURN 'high';
  ELSIF ABS(variance_value) > 1000 THEN RETURN 'medium';
  ELSE RETURN 'low';
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Function to auto-calculate variance fields
CREATE OR REPLACE FUNCTION calculate_count_variance()
RETURNS TRIGGER AS $$
BEGIN
  NEW.variance := NEW.counted_quantity - NEW.system_quantity;
  
  IF NEW.system_quantity > 0 THEN
    NEW.variance_percentage := (NEW.variance::DECIMAL / NEW.system_quantity) * 100;
  ELSE
    NEW.variance_percentage := 0;
  END IF;
  
  NEW.variance_value := NEW.variance * COALESCE(NEW.unit_cost, 0);
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-calculate variance on insert/update
CREATE TRIGGER trigger_calculate_variance
BEFORE INSERT OR UPDATE ON stock_count_items
FOR EACH ROW
EXECUTE FUNCTION calculate_count_variance();

-- Function to auto-flag variances
CREATE OR REPLACE FUNCTION flag_count_variance()
RETURNS TRIGGER AS $$
BEGIN
  IF ABS(NEW.variance) > 0 THEN
    INSERT INTO count_variances (
      count_item_id, product_id, outlet_id, variance, variance_value, severity
    ) VALUES (
      NEW.id, NEW.product_id, NEW.outlet_id, NEW.variance, NEW.variance_value,
      calculate_variance_severity(NEW.variance_value)
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-flag variances after insert
CREATE TRIGGER trigger_flag_variance
AFTER INSERT ON stock_count_items
FOR EACH ROW
EXECUTE FUNCTION flag_count_variance();

-- Create update triggers
CREATE TRIGGER update_count_schedules_updated_at
BEFORE UPDATE ON stock_count_schedules
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_count_variances_updated_at
BEFORE UPDATE ON count_variances
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();