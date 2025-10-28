-- Fix function search path security issue
CREATE OR REPLACE FUNCTION calculate_reorder_quantity(
  p_avg_daily_sales numeric,
  p_lead_time_days integer,
  p_safety_stock integer,
  p_current_stock integer
) RETURNS integer
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_reorder_point integer;
  v_optimal_quantity integer;
BEGIN
  v_reorder_point := CEIL((p_avg_daily_sales * p_lead_time_days) + p_safety_stock);
  v_optimal_quantity := GREATEST(v_reorder_point * 2, 1);
  
  IF p_current_stock >= v_reorder_point THEN
    RETURN 0;
  END IF;
  
  RETURN v_optimal_quantity - p_current_stock;
END;
$$;