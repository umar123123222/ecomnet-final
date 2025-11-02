-- ============================================================
-- ENFORCE SINGLE ROLE PER USER
-- This migration ensures each user can only have ONE active role
-- ============================================================

-- Step 1: Clean up duplicate active roles
-- Keep only the highest priority role for each user
WITH role_priority AS (
  SELECT 
    user_id,
    role,
    is_active,
    CASE role
      WHEN 'super_admin' THEN 1
      WHEN 'super_manager' THEN 2
      WHEN 'store_manager' THEN 3
      WHEN 'warehouse_manager' THEN 4
      WHEN 'dispatch_manager' THEN 5
      WHEN 'returns_manager' THEN 6
      WHEN 'staff' THEN 7
      WHEN 'supplier' THEN 8
      ELSE 99
    END as priority,
    ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY 
      CASE role
        WHEN 'super_admin' THEN 1
        WHEN 'super_manager' THEN 2
        WHEN 'store_manager' THEN 3
        WHEN 'warehouse_manager' THEN 4
        WHEN 'dispatch_manager' THEN 5
        WHEN 'returns_manager' THEN 6
        WHEN 'staff' THEN 7
        WHEN 'supplier' THEN 8
        ELSE 99
      END ASC
    ) as rn
  FROM user_roles
  WHERE is_active = true
),
roles_to_deactivate AS (
  SELECT user_id, role
  FROM role_priority
  WHERE rn > 1
)
UPDATE user_roles
SET is_active = false
FROM roles_to_deactivate
WHERE user_roles.user_id = roles_to_deactivate.user_id
  AND user_roles.role = roles_to_deactivate.role;

-- Step 2: Delete all inactive role entries (clean slate)
DELETE FROM user_roles WHERE is_active = false;

-- Step 3: Add unique constraint to enforce single role per user
-- Drop the old composite unique constraint first if it exists
ALTER TABLE user_roles DROP CONSTRAINT IF EXISTS user_roles_user_id_role_key;

-- Add new unique constraint on user_id only (ensures only one role per user)
ALTER TABLE user_roles ADD CONSTRAINT user_roles_user_id_unique UNIQUE (user_id);

-- Step 4: Update profiles.role to match the single active role
UPDATE profiles p
SET role = (
  SELECT ur.role 
  FROM user_roles ur 
  WHERE ur.user_id = p.id 
    AND ur.is_active = true
  LIMIT 1
)
WHERE EXISTS (
  SELECT 1 FROM user_roles ur 
  WHERE ur.user_id = p.id 
    AND ur.is_active = true
);

-- Step 5: Create function to auto-sync profile role when user_roles changes
CREATE OR REPLACE FUNCTION sync_profile_role_on_user_role_change()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
    -- Update profile role to match the active user_role
    IF NEW.is_active = true THEN
      UPDATE profiles 
      SET role = NEW.role
      WHERE id = NEW.user_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger to auto-sync
DROP TRIGGER IF EXISTS sync_profile_role_trigger ON user_roles;
CREATE TRIGGER sync_profile_role_trigger
  AFTER INSERT OR UPDATE ON user_roles
  FOR EACH ROW
  EXECUTE FUNCTION sync_profile_role_on_user_role_change();