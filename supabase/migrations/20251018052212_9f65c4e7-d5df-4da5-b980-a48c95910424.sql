-- ========================================
-- PHASE 1: CRITICAL SECURITY FIXES
-- ========================================

-- 1. Create is_super_admin helper function
CREATE OR REPLACE FUNCTION public.is_super_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.user_has_role(_user_id, 'super_admin');
$$;

-- Helper function to check if user is a manager
CREATE OR REPLACE FUNCTION public.is_manager(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id
    AND role IN ('super_admin', 'super_manager', 'store_manager')
    AND is_active = true
  );
$$;

-- 2. Drop and recreate profiles RLS policies with proper security
DROP POLICY IF EXISTS "Super admins can manage all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Authenticated users can view profiles" ON public.profiles;

-- Users can view all profiles
CREATE POLICY "Users can view all profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (true);

-- Users can update their own profile EXCEPT the role field
CREATE POLICY "Users can update own profile except role"
ON public.profiles
FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (
  auth.uid() = id 
  AND role = (SELECT role FROM public.profiles WHERE id = auth.uid())
);

-- Only super admins can manage all profiles including roles
CREATE POLICY "Super admins can manage all profiles"
ON public.profiles
FOR ALL
TO authenticated
USING (public.is_super_admin(auth.uid()))
WITH CHECK (public.is_super_admin(auth.uid()));

-- 3. Update user_roles RLS policies
DROP POLICY IF EXISTS "Super admins can manage all user roles" ON public.user_roles;
DROP POLICY IF EXISTS "Managers can manage staff roles" ON public.user_roles;
DROP POLICY IF EXISTS "Users can view their own roles" ON public.user_roles;

-- Super admins can manage all roles
CREATE POLICY "Super admins can manage all roles"
ON public.user_roles
FOR ALL
TO authenticated
USING (public.is_super_admin(auth.uid()))
WITH CHECK (public.is_super_admin(auth.uid()));

-- Managers can only assign non-admin roles and cannot self-assign
CREATE POLICY "Managers can assign staff roles"
ON public.user_roles
FOR INSERT
TO authenticated
WITH CHECK (
  public.is_manager(auth.uid())
  AND role IN ('staff', 'dispatch_manager', 'returns_manager', 'warehouse_manager')
  AND user_id != auth.uid()
);

CREATE POLICY "Managers can update staff roles"
ON public.user_roles
FOR UPDATE
TO authenticated
USING (
  public.is_manager(auth.uid())
  AND role IN ('staff', 'dispatch_manager', 'returns_manager', 'warehouse_manager')
)
WITH CHECK (
  public.is_manager(auth.uid())
  AND role IN ('staff', 'dispatch_manager', 'returns_manager', 'warehouse_manager')
  AND user_id != auth.uid()
);

CREATE POLICY "Managers can delete staff roles"
ON public.user_roles
FOR DELETE
TO authenticated
USING (
  public.is_manager(auth.uid())
  AND role IN ('staff', 'dispatch_manager', 'returns_manager', 'warehouse_manager')
);

-- Users can view their own roles
CREATE POLICY "Users can view own roles"
ON public.user_roles
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- 4. Add trigger to prevent self-role modification on profiles
CREATE OR REPLACE FUNCTION public.prevent_self_role_modification()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- If trying to modify own profile's role without being super_admin
  IF NEW.id = auth.uid() 
     AND OLD.role != NEW.role 
     AND NOT public.is_super_admin(auth.uid()) 
  THEN
    RAISE EXCEPTION 'Cannot modify your own role. Please contact a super admin.';
  END IF;
  
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_no_self_role_change ON public.profiles;
CREATE TRIGGER enforce_no_self_role_change
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.prevent_self_role_modification();

-- ========================================
-- PHASE 3: AUDIT LOGGING FOR ROLE CHANGES
-- ========================================

CREATE OR REPLACE FUNCTION public.log_role_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.role != NEW.role THEN
    INSERT INTO public.activity_logs (
      user_id,
      action,
      entity_type,
      entity_id,
      details
    ) VALUES (
      COALESCE(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid),
      'role_change',
      'profiles',
      NEW.id,
      jsonb_build_object(
        'old_role', OLD.role,
        'new_role', NEW.role,
        'target_user_id', NEW.id,
        'target_user_email', NEW.email
      )
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS audit_role_changes ON public.profiles;
CREATE TRIGGER audit_role_changes
AFTER UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.log_role_changes();

-- Log changes to user_roles table as well
CREATE OR REPLACE FUNCTION public.log_user_roles_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target_email text;
BEGIN
  IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
    -- Get target user's email
    SELECT email INTO target_email FROM public.profiles WHERE id = NEW.user_id;
  END IF;
  
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.activity_logs (
      user_id,
      action,
      entity_type,
      entity_id,
      details
    ) VALUES (
      COALESCE(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid),
      'role_assigned',
      'user_roles',
      NEW.id,
      jsonb_build_object(
        'role', NEW.role,
        'target_user_id', NEW.user_id,
        'target_user_email', target_email,
        'is_active', NEW.is_active
      )
    );
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO public.activity_logs (
      user_id,
      action,
      entity_type,
      entity_id,
      details
    ) VALUES (
      COALESCE(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid),
      'role_updated',
      'user_roles',
      NEW.id,
      jsonb_build_object(
        'old_is_active', OLD.is_active,
        'new_is_active', NEW.is_active,
        'role', NEW.role,
        'target_user_id', NEW.user_id,
        'target_user_email', target_email
      )
    );
  ELSIF TG_OP = 'DELETE' THEN
    SELECT email INTO target_email FROM public.profiles WHERE id = OLD.user_id;
    INSERT INTO public.activity_logs (
      user_id,
      action,
      entity_type,
      entity_id,
      details
    ) VALUES (
      COALESCE(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid),
      'role_removed',
      'user_roles',
      OLD.id,
      jsonb_build_object(
        'role', OLD.role,
        'target_user_id', OLD.user_id,
        'target_user_email', target_email
      )
    );
    RETURN OLD;
  END IF;
  
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS audit_user_roles_changes ON public.user_roles;
CREATE TRIGGER audit_user_roles_changes
AFTER INSERT OR UPDATE OR DELETE ON public.user_roles
FOR EACH ROW
EXECUTE FUNCTION public.log_user_roles_changes();