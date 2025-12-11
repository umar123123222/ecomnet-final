-- Create missing profile for existing supplier user
INSERT INTO public.profiles (id, email, full_name, role, is_active)
SELECT 
  au.id,
  au.email,
  COALESCE(au.raw_user_meta_data->>'full_name', s.contact_person, 'Supplier'),
  'supplier',
  true
FROM auth.users au
JOIN supplier_profiles sp ON au.id = sp.user_id
JOIN suppliers s ON sp.supplier_id = s.id
LEFT JOIN profiles p ON au.id = p.id
WHERE p.id IS NULL;

-- Create missing user_roles entry for existing supplier users
INSERT INTO public.user_roles (user_id, role, is_active, assigned_by)
SELECT 
  au.id,
  'supplier',
  true,
  au.id
FROM auth.users au
JOIN supplier_profiles sp ON au.id = sp.user_id
LEFT JOIN user_roles ur ON au.id = ur.user_id AND ur.role = 'supplier'
WHERE ur.id IS NULL;