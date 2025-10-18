-- Create scans table to track all barcode scanning activity
CREATE TABLE public.scans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scan_type TEXT NOT NULL, -- 'product', 'order', 'tracking', 'package', 'transfer'
  barcode TEXT NOT NULL,
  scan_method TEXT NOT NULL, -- 'handheld', 'camera', 'ocr', 'manual'
  scanned_by UUID NOT NULL REFERENCES auth.users(id),
  
  -- Related entities
  product_id UUID REFERENCES public.products(id),
  order_id UUID REFERENCES public.orders(id),
  outlet_id UUID REFERENCES public.outlets(id),
  
  -- Scan metadata
  raw_data TEXT,
  confidence_score DECIMAL,
  location_data JSONB DEFAULT '{}',
  device_info JSONB DEFAULT '{}',
  
  -- Processing
  processed BOOLEAN DEFAULT false,
  processing_status TEXT DEFAULT 'pending', -- 'pending', 'processed', 'failed', 'duplicate'
  processing_notes TEXT,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed_at TIMESTAMPTZ
);

-- Enable RLS
ALTER TABLE public.scans ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own scans"
  ON public.scans FOR SELECT
  USING (scanned_by = auth.uid());

CREATE POLICY "Users can create scans"
  ON public.scans FOR INSERT
  WITH CHECK (scanned_by = auth.uid());

CREATE POLICY "Managers can view all scans"
  ON public.scans FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
      AND role IN ('super_admin', 'super_manager', 'warehouse_manager')
      AND is_active = true
    )
  );

CREATE POLICY "System can update scans"
  ON public.scans FOR UPDATE
  USING (true);

-- Create indexes for performance
CREATE INDEX idx_scans_barcode ON public.scans(barcode);
CREATE INDEX idx_scans_product_id ON public.scans(product_id);
CREATE INDEX idx_scans_scanned_by ON public.scans(scanned_by);
CREATE INDEX idx_scans_created_at ON public.scans(created_at DESC);
CREATE INDEX idx_scans_scan_type ON public.scans(scan_type);
CREATE INDEX idx_scans_processing_status ON public.scans(processing_status);

-- Add barcode columns to products table if not exists
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'products' AND column_name = 'barcode') THEN
    ALTER TABLE public.products ADD COLUMN barcode TEXT;
    CREATE INDEX idx_products_barcode ON public.products(barcode) WHERE barcode IS NOT NULL;
  END IF;
END $$;

-- Add scan tracking to stock counts
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'stock_count_items' AND column_name = 'scanned') THEN
    ALTER TABLE public.stock_count_items ADD COLUMN scanned BOOLEAN DEFAULT false;
    ALTER TABLE public.stock_count_items ADD COLUMN scan_timestamp TIMESTAMPTZ;
    ALTER TABLE public.stock_count_items ADD COLUMN scanned_by UUID REFERENCES auth.users(id);
  END IF;
END $$;

-- Function to match barcode to product
CREATE OR REPLACE FUNCTION public.match_barcode_to_product(p_barcode TEXT)
RETURNS UUID
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_product_id UUID;
BEGIN
  -- Try exact barcode match
  SELECT id INTO v_product_id
  FROM products
  WHERE barcode = p_barcode AND is_active = true
  LIMIT 1;
  
  IF FOUND THEN
    RETURN v_product_id;
  END IF;
  
  -- Try SKU match
  SELECT id INTO v_product_id
  FROM products
  WHERE sku = p_barcode AND is_active = true
  LIMIT 1;
  
  RETURN v_product_id;
END;
$$;