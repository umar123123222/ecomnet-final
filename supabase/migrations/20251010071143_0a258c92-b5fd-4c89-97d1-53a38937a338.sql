-- 1) Drop dependent policies and functions to allow enum recreation
DROP POLICY IF EXISTS "Owners can view all performance" ON user_performance;
DROP POLICY IF EXISTS "Owners can manage all user roles" ON user_roles;
DROP POLICY IF EXISTS "Store managers can manage staff roles" ON user_roles;
DROP POLICY IF EXISTS "Owners can manage all profiles" ON profiles;

-- Drop functions that depend on user_role enum
DROP FUNCTION IF EXISTS public.get_user_roles(uuid);
DROP FUNCTION IF EXISTS public.user_has_role(uuid, user_role);
DROP FUNCTION IF EXISTS public.get_current_user_role();

-- 2) Ensure all legacy values are remapped in data BEFORE type change
UPDATE profiles 
SET role = CASE 
  WHEN role = 'owner' THEN 'super_admin'
  WHEN role = 'SuperAdmin' THEN 'super_admin'
  WHEN role = 'Manager' THEN 'super_manager'
  WHEN role = 'Dispatch/Returns Manager' THEN 'dispatch_manager'
  ELSE role
END
WHERE role IN ('owner', 'SuperAdmin', 'Manager', 'Dispatch/Returns Manager');

UPDATE user_roles 
SET role = CASE 
  WHEN role = 'owner' THEN 'super_admin'
  WHEN role = 'SuperAdmin' THEN 'super_admin'
  WHEN role = 'Manager' THEN 'super_manager'
  WHEN role = 'Dispatch/Returns Manager' THEN 'dispatch_manager'
  ELSE role
END
WHERE role IN ('owner', 'SuperAdmin', 'Manager', 'Dispatch/Returns Manager');

-- 3) Recreate the enum without legacy values
CREATE TYPE user_role_new AS ENUM (
  'super_admin',
  'super_manager',
  'warehouse_manager',
  'store_manager',
  'dispatch_manager',
  'returns_manager',
  'staff'
);

-- Drop defaults before altering column types
ALTER TABLE profiles ALTER COLUMN role DROP DEFAULT;
-- user_roles.role has no default, but run defensively
ALTER TABLE user_roles ALTER COLUMN role DROP DEFAULT;

-- 4) Alter columns to the new enum type
ALTER TABLE profiles 
  ALTER COLUMN role TYPE user_role_new USING role::text::user_role_new;

ALTER TABLE user_roles 
  ALTER COLUMN role TYPE user_role_new USING role::text::user_role_new;

-- 5) Drop the old enum and rename the new one
DROP TYPE user_role;
ALTER TYPE user_role_new RENAME TO user_role;

-- 6) Recreate functions depending on the enum
CREATE OR REPLACE FUNCTION public.user_has_role(user_id uuid, check_role user_role)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_roles.user_id = $1 
    AND user_roles.role = $2 
    AND user_roles.is_active = true
  );
$function$;

CREATE OR REPLACE FUNCTION public.get_user_roles(user_id uuid)
RETURNS user_role[]
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT ARRAY_AGG(role) 
  FROM public.user_roles 
  WHERE user_roles.user_id = $1 
  AND user_roles.is_active = true;
$function$;

CREATE OR REPLACE FUNCTION public.get_current_user_role()
RETURNS user_role
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT role FROM public.profiles WHERE id = auth.uid() LIMIT 1;
$function$;

-- 7) Re-add defaults
ALTER TABLE profiles ALTER COLUMN role SET DEFAULT 'staff'::user_role;

-- 8) Recreate RLS policies with new role names
CREATE POLICY "Super admins can view all performance" ON user_performance
  FOR SELECT 
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role = 'super_admin'
    )
  );

CREATE POLICY "Super admins can manage all user roles" ON user_roles
  FOR ALL 
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role = 'super_admin'
    )
  );

CREATE POLICY "Managers can manage staff roles" ON user_roles
  FOR ALL 
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role IN ('super_admin', 'super_manager', 'store_manager')
    )
    AND role IN ('staff', 'dispatch_manager', 'returns_manager', 'warehouse_manager')
  );

CREATE POLICY "Super admins can manage all profiles" ON profiles
  FOR ALL 
  TO authenticated
  USING (
    get_current_user_role() = 'super_admin'
  );
