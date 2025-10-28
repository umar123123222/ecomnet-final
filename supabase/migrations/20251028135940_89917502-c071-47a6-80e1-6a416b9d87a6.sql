-- Enable real-time for api_settings table
ALTER TABLE public.api_settings REPLICA IDENTITY FULL;

-- Add table to realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE public.api_settings;