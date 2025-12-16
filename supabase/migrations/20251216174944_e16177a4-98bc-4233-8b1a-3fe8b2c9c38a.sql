-- Allow finance and other authorized roles to read order_items (needed for cancelled order value calculations)

ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  -- Create policy only if it doesn't already exist
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'order_items'
      AND policyname = 'Authorized users can view order items'
  ) THEN
    CREATE POLICY "Authorized users can view order items"
    ON public.order_items
    FOR SELECT
    USING (
      auth.uid() IS NOT NULL
      AND EXISTS (
        SELECT 1
        FROM public.user_roles ur
        WHERE ur.user_id = auth.uid()
          AND ur.is_active = true
          AND ur.role IN (
            'super_admin',
            'super_manager',
            'warehouse_manager',
            'dispatch_manager',
            'returns_manager',
            'store_manager',
            'finance'
          )
      )
    );
  END IF;
END $$;