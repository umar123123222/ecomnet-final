-- Remove all roles except super_admin for Muhammad Umar
DELETE FROM user_roles
WHERE user_id = 'ff812d62-9e9e-4ba6-a462-45ecb6fb4b16'
  AND role != 'super_admin';