-- Enable RLS on the new archive table
ALTER TABLE public.sync_queue_archive ENABLE ROW LEVEL SECURITY;

-- Only super_admin can view archive (for debugging)
CREATE POLICY "Super admins can view sync queue archive"
ON public.sync_queue_archive
FOR SELECT
USING (public.is_super_admin(auth.uid()));