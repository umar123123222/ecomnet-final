-- Set Muhammad Umar (umaridmpakistan@gmail.com) to super_admin only

-- Deactivate all roles except super_admin for this user
UPDATE user_roles
SET is_active = false
WHERE user_id = 'ff812d62-9e9e-4ba6-a462-45ecb6fb4b16'
  AND role != 'super_admin';

-- Ensure super_admin role is active
UPDATE user_roles
SET is_active = true
WHERE user_id = 'ff812d62-9e9e-4ba6-a462-45ecb6fb4b16'
  AND role = 'super_admin';

-- Update primary role in profiles
UPDATE profiles
SET role = 'super_admin'
WHERE id = 'ff812d62-9e9e-4ba6-a462-45ecb6fb4b16';