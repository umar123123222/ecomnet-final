-- Part 3: Audit trail and Input Validation

-- 1. Add audit trail function for sensitive operations
CREATE OR REPLACE FUNCTION public.audit_sensitive_operation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.activity_logs (
    user_id,
    entity_type,
    entity_id,
    action,
    details
  ) VALUES (
    COALESCE(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid),
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
$$;

-- Add audit triggers for critical tables
DROP TRIGGER IF EXISTS audit_orders_changes ON public.orders;
CREATE TRIGGER audit_orders_changes
  AFTER UPDATE ON public.orders
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status OR OLD.total_amount IS DISTINCT FROM NEW.total_amount)
  EXECUTE FUNCTION public.audit_sensitive_operation();

DROP TRIGGER IF EXISTS audit_dispatches_changes ON public.dispatches;
CREATE TRIGGER audit_dispatches_changes
  AFTER INSERT OR UPDATE ON public.dispatches
  FOR EACH ROW
  EXECUTE FUNCTION public.audit_sensitive_operation();