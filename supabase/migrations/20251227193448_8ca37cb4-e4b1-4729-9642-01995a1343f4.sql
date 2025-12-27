-- Add RLS policy for super admins to delete dispatch summaries
CREATE POLICY "Super admins can delete dispatch summaries" 
ON public.daily_dispatch_summaries 
FOR DELETE 
USING (
  EXISTS (
    SELECT 1 FROM user_roles 
    WHERE user_roles.user_id = auth.uid() 
    AND user_roles.role = 'super_admin' 
    AND user_roles.is_active = true
  )
);