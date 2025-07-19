-- Fix the infinite recursion issue in profiles table RLS policies
-- Drop the problematic policy and recreate it properly
DROP POLICY IF EXISTS "Owners can manage all profiles" ON public.profiles;

-- Create a security definer function to avoid recursion
CREATE OR REPLACE FUNCTION public.get_current_user_role()
RETURNS user_role AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid() LIMIT 1;
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

-- Create new policy using the function to avoid recursion
CREATE POLICY "Owners can manage all profiles" ON public.profiles
FOR ALL
TO authenticated
USING (public.get_current_user_role() = 'owner');

-- Create simple policy for authenticated users to view profiles
CREATE POLICY "Authenticated users can view profiles" ON public.profiles
FOR SELECT
TO authenticated  
USING (true);

-- Enable RLS and create policy for product table
ALTER TABLE public.product ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view products" ON public.product
FOR SELECT
TO authenticated
USING (true);