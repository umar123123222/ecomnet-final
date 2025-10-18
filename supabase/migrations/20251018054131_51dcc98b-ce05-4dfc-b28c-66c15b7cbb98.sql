-- POS System Database Schema

-- POS Sessions (Shift Management)
CREATE TABLE pos_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_number TEXT UNIQUE NOT NULL,
  outlet_id UUID NOT NULL REFERENCES outlets(id),
  cashier_id UUID NOT NULL REFERENCES profiles(id),
  register_number TEXT,
  opened_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  closed_at TIMESTAMP WITH TIME ZONE,
  opening_cash DECIMAL(10,2) NOT NULL DEFAULT 0,
  closing_cash DECIMAL(10,2),
  expected_cash DECIMAL(10,2),
  cash_difference DECIMAL(10,2),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed', 'suspended')),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- POS Sales
CREATE TABLE pos_sales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_number TEXT UNIQUE NOT NULL,
  session_id UUID NOT NULL REFERENCES pos_sessions(id),
  outlet_id UUID NOT NULL REFERENCES outlets(id),
  cashier_id UUID NOT NULL REFERENCES profiles(id),
  customer_id UUID REFERENCES customers(id),
  sale_date TIMESTAMP WITH TIME ZONE DEFAULT now(),
  subtotal DECIMAL(10,2) NOT NULL,
  tax_amount DECIMAL(10,2) DEFAULT 0,
  discount_amount DECIMAL(10,2) DEFAULT 0,
  total_amount DECIMAL(10,2) NOT NULL,
  amount_paid DECIMAL(10,2) NOT NULL,
  change_amount DECIMAL(10,2) DEFAULT 0,
  payment_method TEXT NOT NULL CHECK (payment_method IN ('cash', 'card', 'mobile_wallet', 'split')),
  payment_reference TEXT,
  status TEXT NOT NULL DEFAULT 'completed' CHECK (status IN ('pending', 'completed', 'voided', 'refunded')),
  voided_at TIMESTAMP WITH TIME ZONE,
  voided_by UUID REFERENCES profiles(id),
  void_reason TEXT,
  receipt_printed BOOLEAN DEFAULT false,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- POS Sale Items
CREATE TABLE pos_sale_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id UUID NOT NULL REFERENCES pos_sales(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id),
  quantity INTEGER NOT NULL,
  unit_price DECIMAL(10,2) NOT NULL,
  discount_percent DECIMAL(5,2) DEFAULT 0,
  discount_amount DECIMAL(10,2) DEFAULT 0,
  line_total DECIMAL(10,2) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- POS Transactions (for split payments)
CREATE TABLE pos_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id UUID NOT NULL REFERENCES pos_sales(id) ON DELETE CASCADE,
  payment_method TEXT NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  payment_reference TEXT,
  transaction_status TEXT NOT NULL DEFAULT 'completed' CHECK (transaction_status IN ('pending', 'completed', 'failed', 'refunded')),
  processed_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- POS Receipts
CREATE TABLE pos_receipts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id UUID NOT NULL REFERENCES pos_sales(id),
  receipt_number TEXT UNIQUE NOT NULL,
  receipt_type TEXT NOT NULL CHECK (receipt_type IN ('sale', 'return', 'void')),
  receipt_data JSONB NOT NULL,
  printed_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  printed_by UUID REFERENCES profiles(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Cash Drawer Events
CREATE TABLE cash_drawer_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES pos_sessions(id),
  event_type TEXT NOT NULL CHECK (event_type IN ('open', 'sale', 'refund', 'cash_in', 'cash_out', 'close')),
  amount DECIMAL(10,2) NOT NULL,
  reference_id UUID,
  notes TEXT,
  created_by UUID NOT NULL REFERENCES profiles(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create indexes for performance
CREATE INDEX idx_pos_sessions_outlet_id ON pos_sessions(outlet_id);
CREATE INDEX idx_pos_sessions_cashier_id ON pos_sessions(cashier_id);
CREATE INDEX idx_pos_sessions_status ON pos_sessions(status);
CREATE INDEX idx_pos_sales_session_id ON pos_sales(session_id);
CREATE INDEX idx_pos_sales_outlet_id ON pos_sales(outlet_id);
CREATE INDEX idx_pos_sales_sale_date ON pos_sales(sale_date);
CREATE INDEX idx_pos_sales_status ON pos_sales(status);
CREATE INDEX idx_pos_sale_items_sale_id ON pos_sale_items(sale_id);
CREATE INDEX idx_pos_sale_items_product_id ON pos_sale_items(product_id);
CREATE INDEX idx_cash_drawer_events_session_id ON cash_drawer_events(session_id);

-- Enable RLS on all tables
ALTER TABLE pos_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE pos_sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE pos_sale_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE pos_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE pos_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE cash_drawer_events ENABLE ROW LEVEL SECURITY;

-- RLS Policies for pos_sessions
CREATE POLICY "Cashiers can view their own sessions"
ON pos_sessions FOR SELECT
TO authenticated
USING (cashier_id = auth.uid());

CREATE POLICY "Managers can view all sessions at their outlets"
ON pos_sessions FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM outlets o
    WHERE o.id = pos_sessions.outlet_id
    AND (o.manager_id = auth.uid() OR is_manager(auth.uid()))
  )
);

CREATE POLICY "Cashiers can create sessions"
ON pos_sessions FOR INSERT
TO authenticated
WITH CHECK (cashier_id = auth.uid());

CREATE POLICY "Cashiers can update their own open sessions"
ON pos_sessions FOR UPDATE
TO authenticated
USING (cashier_id = auth.uid() AND status = 'open');

-- RLS Policies for pos_sales
CREATE POLICY "Staff can view sales at their outlet"
ON pos_sales FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.is_active = true
  )
);

CREATE POLICY "Cashiers can create sales"
ON pos_sales FOR INSERT
TO authenticated
WITH CHECK (cashier_id = auth.uid());

CREATE POLICY "Managers can void sales"
ON pos_sales FOR UPDATE
TO authenticated
USING (is_manager(auth.uid()));

-- RLS Policies for pos_sale_items
CREATE POLICY "Staff can view sale items"
ON pos_sale_items FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM pos_sales
    WHERE pos_sales.id = pos_sale_items.sale_id
  )
);

CREATE POLICY "Cashiers can create sale items"
ON pos_sale_items FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM pos_sales
    WHERE pos_sales.id = pos_sale_items.sale_id
    AND pos_sales.cashier_id = auth.uid()
  )
);

-- RLS Policies for pos_transactions
CREATE POLICY "Staff can view transactions"
ON pos_transactions FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM pos_sales
    WHERE pos_sales.id = pos_transactions.sale_id
  )
);

CREATE POLICY "Cashiers can create transactions"
ON pos_transactions FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM pos_sales
    WHERE pos_sales.id = pos_transactions.sale_id
    AND pos_sales.cashier_id = auth.uid()
  )
);

-- RLS Policies for pos_receipts
CREATE POLICY "Staff can view receipts"
ON pos_receipts FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM pos_sales
    WHERE pos_sales.id = pos_receipts.sale_id
  )
);

CREATE POLICY "Cashiers can create receipts"
ON pos_receipts FOR INSERT
TO authenticated
WITH CHECK (printed_by = auth.uid());

-- RLS Policies for cash_drawer_events
CREATE POLICY "Cashiers can view their session events"
ON cash_drawer_events FOR SELECT
TO authenticated
USING (created_by = auth.uid());

CREATE POLICY "Managers can view all drawer events"
ON cash_drawer_events FOR SELECT
TO authenticated
USING (is_manager(auth.uid()));

CREATE POLICY "Cashiers can create drawer events"
ON cash_drawer_events FOR INSERT
TO authenticated
WITH CHECK (created_by = auth.uid());

-- Function to generate session number
CREATE OR REPLACE FUNCTION generate_session_number()
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  new_number TEXT;
BEGIN
  SELECT 'SES-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' || LPAD(COALESCE(MAX(SUBSTRING(session_number FROM 14)::INTEGER), 0) + 1, 4, '0')
  INTO new_number
  FROM pos_sessions
  WHERE session_number LIKE 'SES-' || TO_CHAR(NOW(), 'YYYYMMDD') || '%';
  
  RETURN new_number;
END;
$$;

-- Function to generate sale number
CREATE OR REPLACE FUNCTION generate_sale_number()
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  new_number TEXT;
BEGIN
  SELECT 'SALE-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' || LPAD(COALESCE(MAX(SUBSTRING(sale_number FROM 15)::INTEGER), 0) + 1, 6, '0')
  INTO new_number
  FROM pos_sales
  WHERE sale_number LIKE 'SALE-' || TO_CHAR(NOW(), 'YYYYMMDD') || '%';
  
  RETURN new_number;
END;
$$;

-- Function to generate receipt number
CREATE OR REPLACE FUNCTION generate_receipt_number()
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  new_number TEXT;
BEGIN
  SELECT 'RCP-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' || LPAD(COALESCE(MAX(SUBSTRING(receipt_number FROM 14)::INTEGER), 0) + 1, 6, '0')
  INTO new_number
  FROM pos_receipts
  WHERE receipt_number LIKE 'RCP-' || TO_CHAR(NOW(), 'YYYYMMDD') || '%';
  
  RETURN new_number;
END;
$$;