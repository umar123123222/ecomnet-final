-- Update RLS policy to allow warehouse managers to delete products
DROP POLICY IF EXISTS "Admins can delete products" ON products;

CREATE POLICY "Admins and warehouse managers can delete products"
ON products
FOR DELETE
TO public
USING (
  EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role = ANY(ARRAY['super_admin'::user_role, 'super_manager'::user_role, 'warehouse_manager'::user_role])
    AND user_roles.is_active = true
  )
);