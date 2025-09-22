-- Update user_role enum to match new role structure
-- First drop dependent policies and functions that use the enum
DROP POLICY IF EXISTS "Owners can manage all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Owners can manage all user roles" ON public.user_roles;
DROP POLICY IF EXISTS "Store managers can manage staff roles" ON public.user_roles;
DROP POLICY IF EXISTS "Owners can view all performance" ON public.user_performance;

-- Drop the function that depends on the enum
DROP FUNCTION IF EXISTS public.get_current_user_role();

-- Create new enum with the updated roles
DROP TYPE IF EXISTS public.user_role CASCADE;
CREATE TYPE public.user_role AS ENUM ('SuperAdmin', 'Manager', 'Dispatch/Returns Manager', 'Staff');

-- Update profiles table to use new enum and set default values
ALTER TABLE public.profiles 
ALTER COLUMN role SET DEFAULT 'Staff'::user_role;

-- Update existing records to match new enum values
UPDATE public.profiles 
SET role = CASE 
  WHEN role::text = 'owner' THEN 'SuperAdmin'::user_role
  WHEN role::text = 'store_manager' THEN 'Manager'::user_role
  WHEN role::text = 'dispatch_manager' OR role::text = 'returns_manager' THEN 'Dispatch/Returns Manager'::user_role
  ELSE 'Staff'::user_role
END;

-- Update user_roles table
UPDATE public.user_roles 
SET role = CASE 
  WHEN role::text = 'owner' THEN 'SuperAdmin'::user_role
  WHEN role::text = 'store_manager' THEN 'Manager'::user_role
  WHEN role::text = 'dispatch_manager' OR role::text = 'returns_manager' THEN 'Dispatch/Returns Manager'::user_role
  ELSE 'Staff'::user_role
END;

-- Recreate the function
CREATE OR REPLACE FUNCTION public.get_current_user_role()
 RETURNS user_role
 LANGUAGE sql
 STABLE SECURITY DEFINER
AS $function$
  SELECT role FROM public.profiles WHERE id = auth.uid() LIMIT 1;
$function$;

-- Recreate the policies with updated role references
CREATE POLICY "SuperAdmins can manage all profiles" 
ON public.profiles 
FOR ALL 
USING (get_current_user_role() = 'SuperAdmin'::user_role);

CREATE POLICY "SuperAdmins can manage all user roles" 
ON public.user_roles 
FOR ALL 
USING (EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'SuperAdmin'::user_role))));

CREATE POLICY "Managers can manage staff roles" 
ON public.user_roles 
FOR ALL 
USING ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = ANY (ARRAY['SuperAdmin'::user_role, 'Manager'::user_role]))))) AND (role = ANY (ARRAY['Staff'::user_role, 'Dispatch/Returns Manager'::user_role])));

CREATE POLICY "SuperAdmins can view all performance" 
ON public.user_performance 
FOR SELECT 
USING (EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'SuperAdmin'::user_role))));