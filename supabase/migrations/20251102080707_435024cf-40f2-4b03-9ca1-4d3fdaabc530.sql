-- Create helper function to ensure supplier role is active for users with supplier profiles
CREATE OR REPLACE FUNCTION ensure_supplier_role(target_user_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- If user has a supplier profile, ensure they have active supplier role
  IF EXISTS (SELECT 1 FROM supplier_profiles WHERE user_id = target_user_id) THEN
    INSERT INTO user_roles (user_id, role, is_active)
    VALUES (target_user_id, 'supplier', true)
    ON CONFLICT (user_id, role) 
    DO UPDATE SET is_active = true;
  END IF;
END;
$$;

-- Add supplier role to all existing users with supplier profiles
INSERT INTO user_roles (user_id, role, is_active)
SELECT sp.user_id, 'supplier'::user_role, true
FROM supplier_profiles sp
ON CONFLICT (user_id, role) 
DO UPDATE SET is_active = true, updated_at = now();