-- Drop existing UPDATE policy
DROP POLICY IF EXISTS "Authorized users can update orders" ON public.orders;

-- Create explicit UPDATE policy with both USING and WITH CHECK clauses
-- Includes all manager roles and staff for status updates
CREATE POLICY "Authorized users can update orders"
ON public.orders
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
      AND role IN ('super_admin','super_manager','store_manager','warehouse_manager','dispatch_manager','returns_manager','staff')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
      AND role IN ('super_admin','super_manager','store_manager','warehouse_manager','dispatch_manager','returns_manager','staff')
  )
);

-- Create trigger function to enforce staff can only update status
CREATE OR REPLACE FUNCTION public.enforce_staff_status_only()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_role public.user_role;
BEGIN
  -- Get current user's role
  SELECT role INTO user_role
  FROM public.profiles
  WHERE id = auth.uid();
  
  -- If user is staff, only allow status updates
  IF user_role = 'staff' THEN
    -- Check if any field other than status, updated_at is being changed
    IF (
      OLD.order_number IS DISTINCT FROM NEW.order_number OR
      OLD.customer_id IS DISTINCT FROM NEW.customer_id OR
      OLD.customer_name IS DISTINCT FROM NEW.customer_name OR
      OLD.customer_phone IS DISTINCT FROM NEW.customer_phone OR
      OLD.customer_email IS DISTINCT FROM NEW.customer_email OR
      OLD.customer_address IS DISTINCT FROM NEW.customer_address OR
      OLD.customer_new_address IS DISTINCT FROM NEW.customer_new_address OR
      OLD.city IS DISTINCT FROM NEW.city OR
      OLD.outlet_id IS DISTINCT FROM NEW.outlet_id OR
      OLD.total_amount IS DISTINCT FROM NEW.total_amount OR
      OLD.payment_method IS DISTINCT FROM NEW.payment_method OR
      OLD.courier IS DISTINCT FROM NEW.courier OR
      OLD.tracking_id IS DISTINCT FROM NEW.tracking_id OR
      OLD.tags IS DISTINCT FROM NEW.tags OR
      OLD.notes IS DISTINCT FROM NEW.notes OR
      OLD.shopify_order_id IS DISTINCT FROM NEW.shopify_order_id OR
      OLD.confirmation_required IS DISTINCT FROM NEW.confirmation_required OR
      OLD.confirmation_status IS DISTINCT FROM NEW.confirmation_status OR
      OLD.confirmation_deadline IS DISTINCT FROM NEW.confirmation_deadline
    ) THEN
      RAISE EXCEPTION 'Staff can only update order status';
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger
DROP TRIGGER IF EXISTS enforce_staff_status_only ON public.orders;
CREATE TRIGGER enforce_staff_status_only
BEFORE UPDATE ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.enforce_staff_status_only();