-- Create product_barcodes table for 3-level barcode management
CREATE TABLE IF NOT EXISTS public.product_barcodes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  barcode_type TEXT NOT NULL CHECK (barcode_type IN ('raw', 'finished', 'distribution')),
  barcode_value TEXT NOT NULL UNIQUE,
  barcode_format TEXT NOT NULL DEFAULT 'CODE128',
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'used')),
  generated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  generated_by UUID REFERENCES auth.users(id),
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Create index for faster lookups
CREATE INDEX idx_product_barcodes_product_id ON public.product_barcodes(product_id);
CREATE INDEX idx_product_barcodes_barcode_value ON public.product_barcodes(barcode_value);
CREATE INDEX idx_product_barcodes_type ON public.product_barcodes(barcode_type);

-- Enable RLS
ALTER TABLE public.product_barcodes ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Authenticated users can view barcodes"
  ON public.product_barcodes
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authorized users can create barcodes"
  ON public.product_barcodes
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_manager(auth.uid()) OR
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
        AND role IN ('warehouse_manager', 'staff')
        AND is_active = true
    )
  );

CREATE POLICY "Authorized users can update barcodes"
  ON public.product_barcodes
  FOR UPDATE
  TO authenticated
  USING (
    public.is_manager(auth.uid()) OR
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
        AND role IN ('warehouse_manager', 'staff')
        AND is_active = true
    )
  );

-- Update trigger
CREATE TRIGGER update_product_barcodes_updated_at
  BEFORE UPDATE ON public.product_barcodes
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Function to get product lifecycle
CREATE OR REPLACE FUNCTION public.get_product_lifecycle(p_barcode TEXT)
RETURNS TABLE (
  product_id UUID,
  product_name TEXT,
  product_sku TEXT,
  barcode_type TEXT,
  barcode_value TEXT,
  barcode_format TEXT,
  status TEXT,
  generated_at TIMESTAMP WITH TIME ZONE,
  generated_by_name TEXT
) 
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    pb.product_id,
    p.name as product_name,
    p.sku as product_sku,
    pb.barcode_type,
    pb.barcode_value,
    pb.barcode_format,
    pb.status,
    pb.generated_at,
    prof.full_name as generated_by_name
  FROM public.product_barcodes pb
  JOIN public.products p ON p.id = pb.product_id
  LEFT JOIN public.profiles prof ON prof.id = pb.generated_by
  WHERE pb.barcode_value = p_barcode
     OR pb.product_id = (
       SELECT product_id FROM public.product_barcodes 
       WHERE barcode_value = p_barcode LIMIT 1
     )
  ORDER BY pb.generated_at ASC;
END;
$$;