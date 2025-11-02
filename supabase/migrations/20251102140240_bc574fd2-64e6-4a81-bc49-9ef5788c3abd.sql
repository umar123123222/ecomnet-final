
-- Migration to clean up and fix user roles

-- Step 1: Delete orphaned user_roles entries (user_ids not in profiles)
DELETE FROM user_roles
WHERE user_id NOT IN (SELECT id FROM profiles);

-- Step 2: Ensure the foreign key from user_roles to profiles exists with proper name
DO $$ 
BEGIN
  -- Drop existing constraint if it exists
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name LIKE '%user_roles_user_id%' 
    AND table_name = 'user_roles'
  ) THEN
    EXECUTE 'ALTER TABLE public.user_roles DROP CONSTRAINT ' || 
      (SELECT constraint_name FROM information_schema.table_constraints 
       WHERE constraint_name LIKE '%user_roles_user_id%' 
       AND table_name = 'user_roles' LIMIT 1);
  END IF;
END $$;

-- Add named foreign key with ON DELETE CASCADE
ALTER TABLE public.user_roles
ADD CONSTRAINT user_roles_user_id_profiles_fkey 
FOREIGN KEY (user_id) 
REFERENCES public.profiles(id) 
ON DELETE CASCADE;

-- Step 3: Ensure all users without any active roles get one assigned
-- This finds users who have roles but none are active, and activates their highest priority role
WITH users_without_active_roles AS (
  SELECT DISTINCT ur.user_id
  FROM user_roles ur
  WHERE NOT EXISTS (
    SELECT 1 FROM user_roles ur2 
    WHERE ur2.user_id = ur.user_id 
    AND ur2.is_active = true
  )
),
highest_priority_role AS (
  SELECT DISTINCT ON (ur.user_id) 
    ur.id,
    ur.user_id,
    ur.role
  FROM user_roles ur
  INNER JOIN users_without_active_roles uwat ON uwat.user_id = ur.user_id
  ORDER BY ur.user_id, 
    CASE ur.role
      WHEN 'super_admin' THEN 1
      WHEN 'super_manager' THEN 2
      WHEN 'warehouse_manager' THEN 3
      WHEN 'store_manager' THEN 4
      WHEN 'dispatch_manager' THEN 5
      WHEN 'returns_manager' THEN 6
      WHEN 'staff' THEN 7
      WHEN 'supplier' THEN 8
    END
)
UPDATE user_roles
SET is_active = true
WHERE id IN (SELECT id FROM highest_priority_role);

-- Step 4: Ensure all users have at least one role (assign 'staff' if none exist)
INSERT INTO user_roles (user_id, role, is_active)
SELECT p.id, 'staff', true
FROM profiles p
WHERE NOT EXISTS (
  SELECT 1 FROM user_roles ur WHERE ur.user_id = p.id
)
ON CONFLICT (user_id, role) DO UPDATE SET is_active = true;

-- Step 5: Update profiles primary role to match their highest priority active role
UPDATE profiles p
SET role = (
  SELECT ur.role
  FROM user_roles ur
  WHERE ur.user_id = p.id AND ur.is_active = true
  ORDER BY 
    CASE ur.role
      WHEN 'super_admin' THEN 1
      WHEN 'super_manager' THEN 2
      WHEN 'warehouse_manager' THEN 3
      WHEN 'store_manager' THEN 4
      WHEN 'dispatch_manager' THEN 5
      WHEN 'returns_manager' THEN 6
      WHEN 'staff' THEN 7
      WHEN 'supplier' THEN 8
    END
  LIMIT 1
)
WHERE EXISTS (SELECT 1 FROM user_roles ur WHERE ur.user_id = p.id);
