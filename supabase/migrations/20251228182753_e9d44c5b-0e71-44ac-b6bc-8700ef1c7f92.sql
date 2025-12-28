-- Fix search_path for the newly created functions
ALTER FUNCTION get_stuck_at_our_end_count() SET search_path = 'public';
ALTER FUNCTION get_stuck_at_courier_count() SET search_path = 'public';
ALTER FUNCTION get_stuck_orders_at_our_end(TEXT, INTEGER, INTEGER) SET search_path = 'public';
ALTER FUNCTION get_stuck_orders_at_courier_end(TEXT, INTEGER, INTEGER) SET search_path = 'public';