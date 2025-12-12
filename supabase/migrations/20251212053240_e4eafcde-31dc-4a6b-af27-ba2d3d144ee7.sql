CREATE OR REPLACE FUNCTION public.get_dashboard_stats(
  p_start_date timestamp with time zone DEFAULT NULL,
  p_end_date timestamp with time zone DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  result JSON;
BEGIN
  SELECT json_build_object(
    'order_counts', (
      SELECT json_object_agg(status, cnt)
      FROM (
        SELECT status, COUNT(*)::INT as cnt
        FROM orders
        WHERE (p_start_date IS NULL OR created_at >= p_start_date)
          AND (p_end_date IS NULL OR created_at <= p_end_date)
        GROUP BY status
      ) s
    ),
    'total_orders', (
      SELECT COUNT(*)::INT FROM orders
      WHERE (p_start_date IS NULL OR created_at >= p_start_date)
        AND (p_end_date IS NULL OR created_at <= p_end_date)
    ),
    'total_revenue', (
      SELECT COALESCE(SUM(total_amount), 0)::NUMERIC FROM orders
      WHERE status = 'delivered'
        AND (p_start_date IS NULL OR created_at >= p_start_date)
        AND (p_end_date IS NULL OR created_at <= p_end_date)
    ),
    'total_customers', (
      SELECT COUNT(DISTINCT customer_id)::INT FROM orders
      WHERE (p_start_date IS NULL OR created_at >= p_start_date)
        AND (p_end_date IS NULL OR created_at <= p_end_date)
    ),
    'pending_count', (
      SELECT COUNT(*)::INT FROM orders WHERE status = 'pending'
    ),
    'dispatched_today', (
      SELECT COUNT(*)::INT FROM orders 
      WHERE status = 'dispatched' 
        AND dispatched_at >= CURRENT_DATE
    )
  ) INTO result;
  
  RETURN result;
END;
$function$;