-- Allow cashiers to close their own sessions by updating RLS policy
ALTER POLICY "Cashiers can update their own open sessions"
ON public.pos_sessions
USING ((cashier_id = auth.uid()) AND (status = 'open'))
WITH CHECK (cashier_id = auth.uid());