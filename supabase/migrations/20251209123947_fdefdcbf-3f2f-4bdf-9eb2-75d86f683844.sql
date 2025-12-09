-- Create tracking update jobs table to track progress and enable resume
CREATE TABLE IF NOT EXISTS public.tracking_update_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'completed', 'failed')),
  total_orders INTEGER NOT NULL DEFAULT 0,
  last_processed_offset INTEGER DEFAULT 0,
  delivered_count INTEGER DEFAULT 0,
  returned_count INTEGER DEFAULT 0,
  failed_count INTEGER DEFAULT 0,
  no_change_count INTEGER DEFAULT 0,
  error_message TEXT,
  trigger_type TEXT DEFAULT 'scheduled',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.tracking_update_jobs ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to view jobs
CREATE POLICY "Authenticated users can view tracking jobs"
ON public.tracking_update_jobs FOR SELECT
TO authenticated
USING (true);

-- Allow service role full access
CREATE POLICY "Service role can manage tracking jobs"
ON public.tracking_update_jobs FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Index for finding incomplete jobs
CREATE INDEX idx_tracking_jobs_status_started ON public.tracking_update_jobs(status, started_at DESC);

-- Cleanup old completed jobs (keep last 30 days)
CREATE OR REPLACE FUNCTION cleanup_old_tracking_jobs()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM tracking_update_jobs
  WHERE completed_at < NOW() - INTERVAL '30 days';
END;
$$;