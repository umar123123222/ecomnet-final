-- Fix security warnings: Add search_path to functions that are missing it
-- This prevents search_path hijacking attacks

-- Fix calculate_variance_severity
CREATE OR REPLACE FUNCTION public.calculate_variance_severity(variance_value numeric)
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF ABS(variance_value) > 10000 THEN RETURN 'critical';
  ELSIF ABS(variance_value) > 5000 THEN RETURN 'high';
  ELSIF ABS(variance_value) > 1000 THEN RETURN 'medium';
  ELSE RETURN 'low';
  END IF;
END;
$$;

-- Fix calculate_count_variance
CREATE OR REPLACE FUNCTION public.calculate_count_variance()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.variance := NEW.counted_quantity - NEW.system_quantity;
  
  IF NEW.system_quantity > 0 THEN
    NEW.variance_percentage := (NEW.variance::DECIMAL / NEW.system_quantity) * 100;
  ELSE
    NEW.variance_percentage := 0;
  END IF;
  
  NEW.variance_value := NEW.variance * COALESCE(NEW.unit_cost, 0);
  
  RETURN NEW;
END;
$$;

-- Fix flag_count_variance
CREATE OR REPLACE FUNCTION public.flag_count_variance()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF ABS(NEW.variance) > 0 THEN
    INSERT INTO count_variances (
      count_item_id, product_id, outlet_id, variance, variance_value, severity
    ) VALUES (
      NEW.id, NEW.product_id, NEW.outlet_id, NEW.variance, NEW.variance_value,
      calculate_variance_severity(NEW.variance_value)
    );
  END IF;
  RETURN NEW;
END;
$$;

-- Fix generate_session_number
CREATE OR REPLACE FUNCTION public.generate_session_number()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  next_num INTEGER;
  session_num TEXT;
BEGIN
  SELECT COUNT(*) + 1 INTO next_num
  FROM pos_sessions
  WHERE DATE(created_at) = CURRENT_DATE;
  
  session_num := 'SES-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-' || LPAD(next_num::TEXT, 4, '0');
  
  RETURN session_num;
END;
$$;

-- Fix normalize_phone to be more secure
CREATE OR REPLACE FUNCTION public.normalize_phone(p_phone text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_phone IS NULL THEN
    RETURN NULL;
  END IF;
  RETURN regexp_replace(p_phone, '[^0-9]', '', 'g');
END;
$$;