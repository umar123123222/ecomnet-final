-- Update existing records to use new enum values
UPDATE public.profiles 
SET role = CASE 
  WHEN role = 'owner' THEN 'SuperAdmin'::user_role
  WHEN role = 'store_manager' THEN 'Manager'::user_role
  WHEN role = 'dispatch_manager' OR role = 'returns_manager' THEN 'Dispatch/Returns Manager'::user_role
  WHEN role = 'staff' THEN 'staff'::user_role
  ELSE role
END;

-- Update user_roles table if it exists
UPDATE public.user_roles 
SET role = CASE 
  WHEN role = 'owner' THEN 'SuperAdmin'::user_role
  WHEN role = 'store_manager' THEN 'Manager'::user_role
  WHEN role = 'dispatch_manager' OR role = 'returns_manager' THEN 'Dispatch/Returns Manager'::user_role
  WHEN role = 'staff' THEN 'staff'::user_role
  ELSE role
END;