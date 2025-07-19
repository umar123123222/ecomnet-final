-- Fix the infinite recursion issue in profiles table RLS policies
-- Drop the problematic policy and recreate it properly
DROP POLICY IF EXISTS "Owners can manage all profiles" ON public.profiles;

-- Create a new policy that avoids recursion by using the user_roles table directly
CREATE POLICY "Owners can manage all profiles" ON public.profiles
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() 
    AND role = 'owner'
    AND is_active = true
  )
);

-- Also ensure we have basic policies for profile access
CREATE POLICY IF NOT EXISTS "Public profiles are viewable by authenticated users" ON public.profiles
FOR SELECT
TO authenticated  
USING (true);

-- Create RLS policies for the product table so we can fetch products
ALTER TABLE public.product ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view products" ON public.product
FOR SELECT
TO authenticated
USING (true);