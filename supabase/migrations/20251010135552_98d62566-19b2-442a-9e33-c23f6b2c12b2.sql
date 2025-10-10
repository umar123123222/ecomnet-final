-- Phase 2: Add assigned_to column to orders table and fix user management

-- Add assigned_to column to orders table for staff assignment
ALTER TABLE public.orders 
ADD COLUMN IF NOT EXISTS assigned_to UUID REFERENCES public.profiles(id);

-- Create index for better performance on assigned_to queries
CREATE INDEX IF NOT EXISTS idx_orders_assigned_to ON public.orders(assigned_to);

-- Add comment to document the column
COMMENT ON COLUMN public.orders.assigned_to IS 'Staff member assigned to process this order';