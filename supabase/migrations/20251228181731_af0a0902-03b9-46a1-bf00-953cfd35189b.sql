-- Enable realtime for tracking_update_jobs table (if not already enabled)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND tablename = 'tracking_update_jobs'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.tracking_update_jobs;
  END IF;
END $$;