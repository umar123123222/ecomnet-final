-- Allow store managers to update transfer requests for their outlet (receiving transfers)
CREATE POLICY "Store managers can receive transfers at their outlet"
ON stock_transfer_requests
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid() 
    AND profiles.role = 'store_manager'
  )
  AND (
    EXISTS (
      SELECT 1 FROM outlet_staff
      WHERE outlet_staff.user_id = auth.uid()
      AND outlet_staff.outlet_id = stock_transfer_requests.to_outlet_id
    )
    OR EXISTS (
      SELECT 1 FROM outlets
      WHERE outlets.id = stock_transfer_requests.to_outlet_id
      AND outlets.manager_id = auth.uid()
    )
  )
);

-- Allow store managers to manage inventory at their outlet
CREATE POLICY "Store managers can manage inventory at their outlet"
ON inventory
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid() 
    AND profiles.role = 'store_manager'
  )
  AND (
    EXISTS (
      SELECT 1 FROM outlet_staff
      WHERE outlet_staff.user_id = auth.uid()
      AND outlet_staff.outlet_id = inventory.outlet_id
    )
    OR EXISTS (
      SELECT 1 FROM outlets
      WHERE outlets.id = inventory.outlet_id
      AND outlets.manager_id = auth.uid()
    )
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid() 
    AND profiles.role = 'store_manager'
  )
  AND (
    EXISTS (
      SELECT 1 FROM outlet_staff
      WHERE outlet_staff.user_id = auth.uid()
      AND outlet_staff.outlet_id = inventory.outlet_id
    )
    OR EXISTS (
      SELECT 1 FROM outlets
      WHERE outlets.id = inventory.outlet_id
      AND outlets.manager_id = auth.uid()
    )
  )
);