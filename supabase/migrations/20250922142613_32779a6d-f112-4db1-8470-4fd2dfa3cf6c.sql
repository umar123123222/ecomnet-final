-- Add new enum values to the existing user_role enum
ALTER TYPE public.user_role ADD VALUE 'SuperAdmin';
ALTER TYPE public.user_role ADD VALUE 'Manager';  
ALTER TYPE public.user_role ADD VALUE 'Dispatch/Returns Manager';