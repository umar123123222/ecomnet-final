-- Populate roles table with all system roles and permissions
INSERT INTO public.roles (name, permissions) VALUES
(
  'super_admin',
  '{
    "canAccessDashboard": true,
    "canAccessOrders": true,
    "canAccessCustomers": true,
    "canAccessDispatch": true,
    "canAccessReturns": true,
    "canAccessAddressVerification": true,
    "canAccessUserManagement": true,
    "canAccessAdminPanel": true,
    "canAccessSettings": true,
    "canAddUsers": true,
    "canEditUsers": true,
    "canDeleteUsers": true,
    "canAccessInventory": true,
    "canAccessOutlets": true,
    "canAccessProducts": true,
    "canAccessStockTransfer": true,
    "canAccessLocations": true,
    "canAccessWarehouses": true
  }'::jsonb
),
(
  'super_manager',
  '{
    "canAccessDashboard": true,
    "canAccessOrders": true,
    "canAccessCustomers": true,
    "canAccessDispatch": true,
    "canAccessReturns": true,
    "canAccessAddressVerification": true,
    "canAccessUserManagement": true,
    "canAccessSettings": true,
    "canAddUsers": true,
    "canEditUsers": true,
    "canDeleteUsers": true,
    "canAccessInventory": true,
    "canAccessOutlets": true,
    "canAccessProducts": true,
    "canAccessStockTransfer": true,
    "canAccessLocations": true,
    "canAccessWarehouses": true
  }'::jsonb
),
(
  'store_manager',
  '{
    "canAccessDashboard": true,
    "canAccessOrders": true,
    "canAccessCustomers": true,
    "canAccessDispatch": true,
    "canAccessReturns": true,
    "canAccessAddressVerification": true,
    "canAccessInventory": true,
    "canAccessOutlets": true,
    "canAccessProducts": true,
    "canAccessStockTransfer": true,
    "canAccessLocations": true,
    "canAccessWarehouses": true,
    "canAccessSettings": true
  }'::jsonb
),
(
  'warehouse_manager',
  '{
    "canAccessDashboard": true,
    "canAccessInventory": true,
    "canAccessOutlets": true,
    "canAccessProducts": true,
    "canAccessStockTransfer": true,
    "canAccessLocations": true,
    "canAccessWarehouses": true,
    "canAccessSettings": true
  }'::jsonb
),
(
  'dispatch_manager',
  '{
    "canAccessDashboard": true,
    "canAccessOrders": true,
    "canAccessDispatch": true,
    "canAccessSettings": true
  }'::jsonb
),
(
  'returns_manager',
  '{
    "canAccessDashboard": true,
    "canAccessOrders": true,
    "canAccessReturns": true,
    "canAccessSettings": true
  }'::jsonb
),
(
  'staff',
  '{
    "canAccessDashboard": true,
    "canAccessOrders": true,
    "canAccessCustomers": true,
    "canAccessDispatch": true,
    "canAccessReturns": true,
    "canAccessAddressVerification": true,
    "canAccessSettings": true
  }'::jsonb
)
ON CONFLICT (name) DO UPDATE 
SET permissions = EXCLUDED.permissions;