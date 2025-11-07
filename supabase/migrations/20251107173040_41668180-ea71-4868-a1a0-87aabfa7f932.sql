-- Create table to track missing orders and gaps
CREATE TABLE IF NOT EXISTS public.missing_orders_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number TEXT NOT NULL,
  shopify_order_id BIGINT,
  detected_at TIMESTAMPTZ DEFAULT NOW(),
  synced_at TIMESTAMPTZ,
  sync_status TEXT DEFAULT 'pending' CHECK (sync_status IN ('pending', 'syncing', 'synced', 'failed')),
  error_message TEXT,
  detection_method TEXT DEFAULT 'manual' CHECK (detection_method IN ('manual', 'gap_detection', 'webhook_failure'))
);

-- Create index for fast lookups
CREATE INDEX idx_missing_orders_status ON public.missing_orders_log(sync_status, detected_at DESC);
CREATE INDEX idx_missing_orders_number ON public.missing_orders_log(order_number);

-- Enable RLS
ALTER TABLE public.missing_orders_log ENABLE ROW LEVEL SECURITY;

-- Policy: Managers can view all missing order logs
CREATE POLICY "Managers can view missing order logs"
ON public.missing_orders_log
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
    AND role IN ('super_admin', 'super_manager', 'store_manager')
    AND is_active = true
  )
);

-- Policy: Managers can insert missing order logs
CREATE POLICY "Managers can insert missing order logs"
ON public.missing_orders_log
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
    AND role IN ('super_admin', 'super_manager', 'store_manager')
    AND is_active = true
  )
);

-- Policy: System can update missing order logs
CREATE POLICY "System can update missing order logs"
ON public.missing_orders_log
FOR UPDATE
TO authenticated
USING (true);

COMMENT ON TABLE public.missing_orders_log IS 'Tracks missing orders detected through gap detection or webhook failures';
COMMENT ON COLUMN public.missing_orders_log.detection_method IS 'How the missing order was detected: manual, gap_detection, or webhook_failure';