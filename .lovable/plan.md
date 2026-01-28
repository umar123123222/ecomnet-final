# Fix Inventory Access for Assigned Outlet/Warehouse Managers

## ✅ COMPLETED

The fix has been implemented in `supabase/functions/stock-transfer-request/index.ts`.

### Changes Made

1. **Added `hasInventoryAccess()` helper function** - A broader access check that allows:
   - Super roles (`super_admin`, `super_manager`, `warehouse_manager`) via `profiles.role`
   - Outlet managers via `outlets.manager_id`
   - Any staff assigned to outlet via `outlet_staff` (regardless of `can_access_pos`)

2. **Updated "create" action** - Replaced `has_outlet_access()` RPC with `hasInventoryAccess()`

3. **Updated "receive" action** - Replaced `has_outlet_access()` RPC with `hasInventoryAccess()`

## Access Matrix After Fix

| User Type | Create Transfer | Receive Transfer |
|-----------|-----------------|------------------|
| Super Admin | ✅ All outlets | ✅ All outlets |
| Super Manager | ✅ All outlets | ✅ All outlets |
| Warehouse Manager | ✅ All outlets | ✅ All outlets |
| Store Manager (as manager_id) | ✅ Their outlet | ✅ Their outlet |
| Store Manager (as outlet_staff) | ✅ Their outlet | ✅ Their outlet |
| Staff assigned to outlet | ✅ Their outlet | ✅ Their outlet |
| Unassigned users | ❌ | ❌ |

## Testing

Have Sami Ullah (or any assigned outlet manager) test:
1. Creating a new stock transfer request
2. Receiving incoming stock transfers
