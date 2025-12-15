-- Fix: Update audit trigger to skip logging when no authenticated user
-- Instead of using a fake UUID that violates FK constraint

CREATE OR REPLACE FUNCTION public.audit_sensitive_operation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Skip logging if no authenticated user (system/background operations)
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;
  
  -- Only log if user exists in profiles
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid()) THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.activity_logs (
    user_id,
    entity_type,
    entity_id,
    action,
    details
  ) VALUES (
    auth.uid(),
    TG_TABLE_NAME,
    NEW.id,
    TG_OP,
    jsonb_build_object(
      'old', to_jsonb(OLD),
      'new', to_jsonb(NEW)
    )
  );
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Log error but don't fail the transaction
    RAISE WARNING 'Audit logging failed: %', SQLERRM;
    RETURN NEW;
END;
$function$;

-- Also fix the order status change logger
CREATE OR REPLACE FUNCTION public.log_order_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Skip if no status change
  IF OLD.status IS NOT DISTINCT FROM NEW.status THEN
    RETURN NEW;
  END IF;
  
  -- Skip if no authenticated user
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;
  
  -- Only log if user exists in profiles
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid()) THEN
    RETURN NEW;
  END IF;
  
  INSERT INTO public.activity_logs (
    user_id,
    entity_type,
    entity_id,
    action,
    details
  ) VALUES (
    auth.uid(),
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
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'Activity logging failed: %', SQLERRM;
    RETURN NEW;
END;
$function$;