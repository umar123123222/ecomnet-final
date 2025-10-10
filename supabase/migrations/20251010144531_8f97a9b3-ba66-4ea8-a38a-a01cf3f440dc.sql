-- Fix function security: Add search_path to delete_expired_notifications
CREATE OR REPLACE FUNCTION delete_expired_notifications()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.notifications
  WHERE expires_at IS NOT NULL AND expires_at < now();
  RETURN NULL;
END;
$$;

-- Fix function security: Add search_path to mark_all_notifications_read
CREATE OR REPLACE FUNCTION mark_all_notifications_read(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.notifications
  SET read = true
  WHERE user_id = p_user_id AND read = false;
END;
$$;