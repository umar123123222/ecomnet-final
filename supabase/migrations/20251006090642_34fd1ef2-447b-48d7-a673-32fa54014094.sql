-- Phase 1.2: Enable RLS on Exposed Tables
ALTER TABLE public.leopard_table ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.postex_table ENABLE ROW LEVEL SECURITY;

-- Add policies for authenticated users only
CREATE POLICY "Authenticated users can view leopard_table"
ON public.leopard_table FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can view postex_table"
ON public.postex_table FOR SELECT
TO authenticated
USING (true);

-- Phase 1.3: Fix Security Definer Functions - Add search_path
-- Update all security definer functions to include search_path = public
CREATE OR REPLACE FUNCTION public.user_has_role(user_id uuid, check_role user_role)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_roles.user_id = $1 
    AND user_roles.role = $2 
    AND user_roles.is_active = true
  );
$$;

CREATE OR REPLACE FUNCTION public.get_user_roles(user_id uuid)
RETURNS user_role[]
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT ARRAY_AGG(role) 
  FROM public.user_roles 
  WHERE user_roles.user_id = $1 
  AND user_roles.is_active = true;
$$;

CREATE OR REPLACE FUNCTION public.get_current_user_role()
RETURNS user_role
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid() LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', 'New User'),
    'staff'
  );
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.cleanup_old_conversations()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.conversations 
  WHERE order_id = NEW.order_id 
    AND customer_id = NEW.customer_id 
    AND id NOT IN (
      SELECT id 
      FROM public.conversations 
      WHERE order_id = NEW.order_id 
        AND customer_id = NEW.customer_id 
      ORDER BY created_at DESC 
      LIMIT 10
    );
  
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;