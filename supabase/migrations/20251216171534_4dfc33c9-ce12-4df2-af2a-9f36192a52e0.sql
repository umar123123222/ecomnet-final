-- Create table for courier payment file uploads
CREATE TABLE public.courier_payment_uploads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  courier_id UUID REFERENCES public.couriers(id),
  courier_code TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_url TEXT,
  file_data TEXT,
  invoice_period_start DATE,
  invoice_period_end DATE,
  upload_date TIMESTAMP WITH TIME ZONE DEFAULT now(),
  uploaded_by UUID REFERENCES public.profiles(id),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  total_records INTEGER DEFAULT 0,
  matched_records INTEGER DEFAULT 0,
  unmatched_records INTEGER DEFAULT 0,
  total_amount NUMERIC DEFAULT 0,
  processing_notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create table for payment reconciliation records
CREATE TABLE public.payment_reconciliation_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  upload_id UUID REFERENCES public.courier_payment_uploads(id) ON DELETE CASCADE,
  order_id UUID REFERENCES public.orders(id),
  tracking_id TEXT,
  order_number TEXT,
  courier_code TEXT NOT NULL,
  cod_amount NUMERIC DEFAULT 0,
  courier_charges NUMERIC DEFAULT 0,
  delivery_charges NUMERIC DEFAULT 0,
  return_charges NUMERIC DEFAULT 0,
  other_deductions NUMERIC DEFAULT 0,
  net_amount NUMERIC DEFAULT 0,
  payment_status TEXT DEFAULT 'pending' CHECK (payment_status IN ('paid', 'pending', 'not_eligible', 'mismatch', 'overpaid', 'underpaid')),
  match_status TEXT DEFAULT 'unmatched' CHECK (match_status IN ('matched', 'unmatched', 'partial')),
  delivery_date DATE,
  invoice_date DATE,
  payment_cycle TEXT,
  discrepancy_amount NUMERIC DEFAULT 0,
  discrepancy_reason TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create table for courier analytics cache (for performance)
CREATE TABLE public.courier_analytics_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  courier_id UUID REFERENCES public.couriers(id),
  courier_code TEXT NOT NULL,
  period_type TEXT NOT NULL CHECK (period_type IN ('daily', 'weekly', 'monthly')),
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  total_orders INTEGER DEFAULT 0,
  delivered_orders INTEGER DEFAULT 0,
  returned_orders INTEGER DEFAULT 0,
  total_cod_collected NUMERIC DEFAULT 0,
  delivery_charges NUMERIC DEFAULT 0,
  return_charges NUMERIC DEFAULT 0,
  other_deductions NUMERIC DEFAULT 0,
  net_revenue NUMERIC DEFAULT 0,
  rto_percentage NUMERIC DEFAULT 0,
  avg_payment_cycle_days INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(courier_code, period_type, period_start)
);

-- Enable RLS
ALTER TABLE public.courier_payment_uploads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_reconciliation_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.courier_analytics_cache ENABLE ROW LEVEL SECURITY;

-- RLS Policies for courier_payment_uploads
CREATE POLICY "Finance roles can view payment uploads"
ON public.courier_payment_uploads FOR SELECT
USING (EXISTS (
  SELECT 1 FROM user_roles
  WHERE user_roles.user_id = auth.uid()
  AND user_roles.role IN ('super_admin', 'super_manager', 'finance')
  AND user_roles.is_active = true
));

CREATE POLICY "Finance roles can insert payment uploads"
ON public.courier_payment_uploads FOR INSERT
WITH CHECK (EXISTS (
  SELECT 1 FROM user_roles
  WHERE user_roles.user_id = auth.uid()
  AND user_roles.role IN ('super_admin', 'super_manager', 'finance')
  AND user_roles.is_active = true
));

CREATE POLICY "Finance roles can update payment uploads"
ON public.courier_payment_uploads FOR UPDATE
USING (EXISTS (
  SELECT 1 FROM user_roles
  WHERE user_roles.user_id = auth.uid()
  AND user_roles.role IN ('super_admin', 'super_manager', 'finance')
  AND user_roles.is_active = true
));

-- RLS Policies for payment_reconciliation_records
CREATE POLICY "Finance roles can view reconciliation records"
ON public.payment_reconciliation_records FOR SELECT
USING (EXISTS (
  SELECT 1 FROM user_roles
  WHERE user_roles.user_id = auth.uid()
  AND user_roles.role IN ('super_admin', 'super_manager', 'finance')
  AND user_roles.is_active = true
));

CREATE POLICY "Finance roles can manage reconciliation records"
ON public.payment_reconciliation_records FOR ALL
USING (EXISTS (
  SELECT 1 FROM user_roles
  WHERE user_roles.user_id = auth.uid()
  AND user_roles.role IN ('super_admin', 'super_manager', 'finance')
  AND user_roles.is_active = true
));

-- RLS Policies for courier_analytics_cache
CREATE POLICY "Finance roles can view analytics cache"
ON public.courier_analytics_cache FOR SELECT
USING (EXISTS (
  SELECT 1 FROM user_roles
  WHERE user_roles.user_id = auth.uid()
  AND user_roles.role IN ('super_admin', 'super_manager', 'finance')
  AND user_roles.is_active = true
));

CREATE POLICY "System can manage analytics cache"
ON public.courier_analytics_cache FOR ALL
USING (true);