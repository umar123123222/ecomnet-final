-- Fix handle_new_user trigger to create profile BEFORE inserting into user_roles
-- This prevents foreign key constraint violations

DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  primary_role user_role;
  has_supplier_profile boolean;
BEGIN
  -- STEP 1: Create the profile FIRST (required for foreign key in user_roles)
  INSERT INTO public.profiles (id, email, full_name, role, is_active)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    'staff', -- Temporary default, will be updated below
    true
  )
  ON CONFLICT (id) DO UPDATE
  SET 
    email = EXCLUDED.email,
    full_name = COALESCE(EXCLUDED.full_name, profiles.full_name),
    updated_at = NOW();

  -- STEP 2: Check for supplier profile and ensure supplier role if exists
  SELECT EXISTS(
    SELECT 1 FROM supplier_profiles WHERE user_id = NEW.id
  ) INTO has_supplier_profile;
  
  IF has_supplier_profile THEN
    PERFORM ensure_supplier_role(NEW.id);
  END IF;
  
  -- STEP 3: Check if user has any roles already assigned from user_roles
  -- If not, and no supplier profile, assign default 'staff' role
  IF NOT EXISTS(SELECT 1 FROM user_roles WHERE user_id = NEW.id AND is_active = true) THEN
    -- No active roles found, assign default staff role
    INSERT INTO user_roles (user_id, role, is_active)
    VALUES (NEW.id, 'staff', true)
    ON CONFLICT (user_id, role) DO UPDATE
    SET is_active = true;
  END IF;
  
  -- STEP 4: Get the user's primary role based on hierarchy
  SELECT role INTO primary_role
  FROM user_roles
  WHERE user_id = NEW.id
    AND is_active = true
  ORDER BY 
    CASE role
      WHEN 'super_admin' THEN 1
      WHEN 'super_manager' THEN 2
      WHEN 'store_manager' THEN 3
      WHEN 'warehouse_manager' THEN 4
      WHEN 'dispatch_manager' THEN 5
      WHEN 'returns_manager' THEN 6
      WHEN 'supplier' THEN 7
      WHEN 'staff' THEN 8
      ELSE 9
    END
  LIMIT 1;
  
  -- Fallback to staff if somehow no role was found
  IF primary_role IS NULL THEN
    primary_role := 'staff';
  END IF;

  -- STEP 5: Update profile with the correct primary role
  UPDATE public.profiles
  SET role = primary_role
  WHERE id = NEW.id;
    
  RETURN NEW;
END;
$function$;