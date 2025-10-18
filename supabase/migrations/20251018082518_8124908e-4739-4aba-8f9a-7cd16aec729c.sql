-- Fix generate_session_number function with proper type casting
CREATE OR REPLACE FUNCTION generate_session_number()
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  next_num INTEGER;
  session_num TEXT;
BEGIN
  -- Get the count of sessions today
  SELECT COUNT(*) + 1 INTO next_num
  FROM pos_sessions
  WHERE DATE(created_at) = CURRENT_DATE;
  
  -- Generate session number with proper type casting
  session_num := 'SES-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-' || LPAD(next_num::TEXT, 4, '0');
  
  RETURN session_num;
END;
$$;