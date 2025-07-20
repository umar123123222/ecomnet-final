-- Fix the product table RLS policy issue
-- The previous policy creation might have failed, let's ensure it exists
DROP POLICY IF EXISTS "Authenticated users can view products" ON public.product;

CREATE POLICY "Authenticated users can view products" ON public.product
FOR SELECT
TO authenticated
USING (true);