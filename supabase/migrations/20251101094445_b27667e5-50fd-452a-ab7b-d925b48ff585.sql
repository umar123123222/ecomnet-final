-- Update the handle_new_user trigger to set role from user_roles
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  primary_role user_role;
BEGIN
  -- Get the user's primary role from user_roles table
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
  
  -- If no role found, default to staff
  IF primary_role IS NULL THEN
    primary_role := 'staff';
  END IF;

  -- Insert or update profile
  INSERT INTO public.profiles (id, email, full_name, role, is_active)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    primary_role,
    true
  )
  ON CONFLICT (id) DO UPDATE
  SET 
    email = EXCLUDED.email,
    full_name = COALESCE(EXCLUDED.full_name, profiles.full_name),
    role = EXCLUDED.role,
    updated_at = NOW();
    
  RETURN NEW;
END;
$$;