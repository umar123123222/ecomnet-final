-- Create outlet_staff table for managing staff assignments to outlets
CREATE TABLE outlet_staff (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  outlet_id UUID NOT NULL REFERENCES outlets(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  can_access_pos BOOLEAN NOT NULL DEFAULT false,
  assigned_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(outlet_id, user_id)
);

-- Create index for faster lookups
CREATE INDEX idx_outlet_staff_user ON outlet_staff(user_id);
CREATE INDEX idx_outlet_staff_outlet ON outlet_staff(outlet_id);

-- Create security definer function to check outlet access
CREATE OR REPLACE FUNCTION has_outlet_access(
  _user_id UUID,
  _outlet_id UUID
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  -- Super admins and super managers have access to all outlets
  SELECT EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = _user_id
      AND role IN ('super_admin', 'super_manager')
      AND is_active = true
  )
  OR
  -- Store managers have access to their outlet
  EXISTS (
    SELECT 1 FROM outlets
    WHERE id = _outlet_id
      AND manager_id = _user_id
  )
  OR
  -- Staff have access if explicitly assigned with POS access
  EXISTS (
    SELECT 1 FROM outlet_staff
    WHERE user_id = _user_id
      AND outlet_id = _outlet_id
      AND can_access_pos = true
  );
$$;

-- Enable RLS on outlet_staff
ALTER TABLE outlet_staff ENABLE ROW LEVEL SECURITY;

-- Staff can view their own assignments
CREATE POLICY "Users can view their own outlet assignments"
ON outlet_staff FOR SELECT
USING (auth.uid() = user_id);

-- Managers can view assignments for their outlets
CREATE POLICY "Managers can view their outlet assignments"
ON outlet_staff FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM outlets
    WHERE outlets.id = outlet_staff.outlet_id
      AND outlets.manager_id = auth.uid()
  )
  OR is_manager(auth.uid())
);

-- Managers can assign staff to their outlets
CREATE POLICY "Managers can assign staff to their outlets"
ON outlet_staff FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM outlets
    WHERE outlets.id = outlet_staff.outlet_id
      AND outlets.manager_id = auth.uid()
  )
  OR is_manager(auth.uid())
);

-- Managers can update staff assignments for their outlets
CREATE POLICY "Managers can update staff assignments for their outlets"
ON outlet_staff FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM outlets
    WHERE outlets.id = outlet_staff.outlet_id
      AND outlets.manager_id = auth.uid()
  )
  OR is_manager(auth.uid())
);

-- Managers can delete staff assignments for their outlets
CREATE POLICY "Managers can delete staff assignments for their outlets"
ON outlet_staff FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM outlets
    WHERE outlets.id = outlet_staff.outlet_id
      AND outlets.manager_id = auth.uid()
  )
  OR is_manager(auth.uid())
);

-- Update POS sessions RLS policy to check outlet access
DROP POLICY IF EXISTS "Cashiers can create sessions" ON pos_sessions;
CREATE POLICY "Cashiers can create sessions at assigned outlets"
ON pos_sessions FOR INSERT
WITH CHECK (
  cashier_id = auth.uid()
  AND has_outlet_access(auth.uid(), outlet_id)
);

-- Trigger to update updated_at timestamp
CREATE TRIGGER update_outlet_staff_updated_at
  BEFORE UPDATE ON outlet_staff
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();