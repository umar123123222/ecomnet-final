-- Drop the incorrect foreign key constraint that references public.users
ALTER TABLE public.dispatches 
DROP CONSTRAINT IF EXISTS dispatches_dispatched_by_fkey;

-- Add the correct foreign key referencing profiles table (which syncs with auth.users)
ALTER TABLE public.dispatches 
ADD CONSTRAINT dispatches_dispatched_by_fkey 
FOREIGN KEY (dispatched_by) 
REFERENCES public.profiles(id) 
ON DELETE SET NULL;

-- Add index for better query performance
CREATE INDEX IF NOT EXISTS idx_dispatches_dispatched_by 
ON public.dispatches(dispatched_by);