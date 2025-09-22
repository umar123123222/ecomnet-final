-- Fix the RLS policy for orders table to allow authenticated users to access data
DROP POLICY IF EXISTS "Authenticated users can manage orders" ON public.orders;

-- Create a new policy that correctly checks for authenticated users
CREATE POLICY "Authenticated users can manage orders" 
ON public.orders 
FOR ALL 
USING (auth.uid() IS NOT NULL);