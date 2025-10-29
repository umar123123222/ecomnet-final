-- Add DELETE policy for scans table to allow managers to delete scan records
CREATE POLICY "Managers can delete scans"
ON public.scans
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role IN ('super_admin', 'super_manager', 'warehouse_manager')
    AND is_active = true
  )
);