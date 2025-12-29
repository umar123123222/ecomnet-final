-- Add senior_staff to the user_role enum
ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'senior_staff' AFTER 'staff';