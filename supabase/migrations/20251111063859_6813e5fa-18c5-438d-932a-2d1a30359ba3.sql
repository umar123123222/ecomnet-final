-- Create table to store generated AWBs
CREATE TABLE IF NOT EXISTS public.courier_awbs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  courier_code TEXT NOT NULL,
  order_ids UUID[] NOT NULL,
  tracking_ids TEXT[] NOT NULL,
  pdf_url TEXT,
  pdf_data TEXT,
  generated_by UUID REFERENCES auth.users(id),
  generated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  batch_count INTEGER NOT NULL DEFAULT 0,
  total_orders INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending',
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.courier_awbs ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to view AWBs
CREATE POLICY "Users can view AWBs"
  ON public.courier_awbs
  FOR SELECT
  TO authenticated
  USING (true);

-- Allow authenticated users to insert AWBs
CREATE POLICY "Users can create AWBs"
  ON public.courier_awbs
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = generated_by);

-- Create index for faster lookups
CREATE INDEX idx_courier_awbs_order_ids ON public.courier_awbs USING GIN(order_ids);
CREATE INDEX idx_courier_awbs_courier_code ON public.courier_awbs(courier_code);
CREATE INDEX idx_courier_awbs_status ON public.courier_awbs(status);