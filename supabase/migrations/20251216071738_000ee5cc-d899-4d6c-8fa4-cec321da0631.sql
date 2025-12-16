-- Drop existing view policy and recreate with finance role included
DROP POLICY IF EXISTS "Authorized users can view orders" ON public.orders;

CREATE POLICY "Authorized users can view orders" 
ON public.orders 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role IN ('super_admin', 'super_manager', 'store_manager', 'warehouse_manager', 'staff', 'dispatch_manager', 'returns_manager', 'finance')
    AND user_roles.is_active = true
  )
);