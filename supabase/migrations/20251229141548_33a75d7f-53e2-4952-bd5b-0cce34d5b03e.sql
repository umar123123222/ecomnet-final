-- Drop existing SELECT policy on orders
DROP POLICY IF EXISTS "Authorized users can view orders" ON public.orders;

-- Create updated SELECT policy that includes senior_staff role
CREATE POLICY "Authorized users can view orders" 
ON public.orders 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role IN ('super_admin', 'super_manager', 'store_manager', 'warehouse_manager', 'staff', 'senior_staff', 'dispatch_manager', 'returns_manager', 'finance')
    AND user_roles.is_active = true
  )
);

-- Also update the UPDATE policy to include senior_staff
DROP POLICY IF EXISTS "Authorized users can update orders" ON public.orders;

CREATE POLICY "Authorized users can update orders" 
ON public.orders 
FOR UPDATE 
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role IN ('super_admin', 'super_manager', 'store_manager', 'warehouse_manager', 'dispatch_manager', 'returns_manager', 'staff', 'senior_staff')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role IN ('super_admin', 'super_manager', 'store_manager', 'warehouse_manager', 'dispatch_manager', 'returns_manager', 'staff', 'senior_staff')
  )
);