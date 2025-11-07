-- Remove restrictive status check so enum can govern allowed values
ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_status_check;