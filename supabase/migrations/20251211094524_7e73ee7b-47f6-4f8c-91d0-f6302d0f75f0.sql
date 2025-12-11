-- Update log_order_status_change to handle cases where user doesn't exist
CREATE OR REPLACE FUNCTION public.log_order_status_change()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id UUID;
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    -- Get user_id, preferring auth.uid() if available
    v_user_id := auth.uid();
    
    -- If no auth user, skip logging rather than use a non-existent system user
    IF v_user_id IS NULL THEN
      -- Still return NEW to allow the update, just skip logging
      RETURN NEW;
    END IF;
    
    -- Check if user exists in profiles before inserting
    IF EXISTS (SELECT 1 FROM profiles WHERE id = v_user_id) THEN
      INSERT INTO public.activity_logs (
        user_id,
        entity_type,
        entity_id,
        action,
        details
      ) VALUES (
        v_user_id,
        'order',
        NEW.id,
        'status_changed',
        jsonb_build_object(
          'old_status', OLD.status,
          'new_status', NEW.status,
          'order_number', NEW.order_number,
          'timestamp', NOW()
        )
      );
    END IF;
  END IF;
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Log error but don't fail the transaction
    RAISE WARNING 'Activity logging failed: %', SQLERRM;
    RETURN NEW;
END;
$function$;