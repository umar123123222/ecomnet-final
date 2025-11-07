-- Drop the existing UPDATE policy on orders that's checking user_roles
DROP POLICY IF EXISTS "Authorized users can update orders" ON public.orders;

-- Create new UPDATE policy that checks profiles table for roles
CREATE POLICY "Authorized users can update orders" 
ON public.orders 
FOR UPDATE 
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role IN ('super_admin', 'super_manager', 'store_manager', 'warehouse_manager', 'dispatch_manager', 'returns_manager')
  )
);