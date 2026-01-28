
# Fix Inventory Access for Assigned Outlet/Warehouse Managers

## Problem Summary

Store managers and warehouse managers assigned to specific outlets are getting "Edge Function returned a non-2xx status code" errors when trying to:
1. Create stock transfer requests
2. Receive stock transfers

**Root Cause**: The `has_outlet_access()` database function (used in `stock-transfer-request/index.ts`) was designed for **POS access control**, not inventory operations.

## Current Access Check Logic (Problematic)

The `has_outlet_access()` function in the database checks:

```sql
-- 1. Super admin/super manager ONLY (via user_roles table)
SELECT EXISTS (
  SELECT 1 FROM user_roles
  WHERE user_id = _user_id
    AND role IN ('super_admin', 'super_manager')  -- warehouse_manager NOT included!
    AND is_active = true
)
-- 2. Manager of outlet (via outlets.manager_id)
OR EXISTS (
  SELECT 1 FROM outlets
  WHERE id = _outlet_id AND manager_id = _user_id
)
-- 3. Staff with POS access ONLY
OR EXISTS (
  SELECT 1 FROM outlet_staff
  WHERE user_id = _user_id
    AND outlet_id = _outlet_id
    AND can_access_pos = true  -- This blocks non-POS staff!
);
```

**Problems:**
1. `warehouse_manager` role is NOT included in the super role check
2. Staff assigned via `outlet_staff` without `can_access_pos = true` are blocked
3. Store managers assigned via `outlet_staff` (not as `outlets.manager_id`) are blocked

## Solution

Replace the restrictive `has_outlet_access()` RPC call with a custom access check function that properly handles inventory operations.

### File: `supabase/functions/stock-transfer-request/index.ts`

**Add a new helper function** (after line 109, before `serve()`):

```typescript
// Helper function to check if user has inventory access to an outlet
// Broader than has_outlet_access() RPC - allows any staff assignment, not just POS
async function hasInventoryAccess(
  supabaseClient: any,
  userId: string,
  outletId: string
): Promise<boolean> {
  // Check 1: Super roles via profiles.role (includes warehouse_manager)
  const { data: profile } = await supabaseClient
    .from('profiles')
    .select('role')
    .eq('id', userId)
    .single()

  if (profile?.role && ['super_admin', 'super_manager', 'warehouse_manager'].includes(profile.role)) {
    return true
  }

  // Check 2: User is the designated manager of this outlet
  const { data: managedOutlet } = await supabaseClient
    .from('outlets')
    .select('id')
    .eq('id', outletId)
    .eq('manager_id', userId)
    .maybeSingle()

  if (managedOutlet) {
    return true
  }

  // Check 3: User is assigned to this outlet as staff (any assignment, not just POS)
  const { data: staffAssignment } = await supabaseClient
    .from('outlet_staff')
    .select('id')
    .eq('user_id', userId)
    .eq('outlet_id', outletId)
    .maybeSingle()

  if (staffAssignment) {
    return true
  }

  return false
}
```

**Update the "create" action** (lines 150-161):

Replace:
```typescript
// Check if requesting user has access to destination outlet
const { data: hasAccess } = await supabaseClient.rpc('has_outlet_access', {
  _user_id: user.id,
  _outlet_id: finalToOutletId
})

if (!hasAccess) {
  return new Response(
    JSON.stringify({ error: 'No access to destination outlet' }),
    { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  )
}
```

With:
```typescript
// Check if requesting user has inventory access to destination outlet
const hasAccess = await hasInventoryAccess(supabaseClient, user.id, finalToOutletId)

if (!hasAccess) {
  return new Response(
    JSON.stringify({ error: 'No access to destination outlet. You must be assigned as manager or staff of this outlet.' }),
    { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  )
}
```

**Update the "receive" action** (lines 684-694):

Replace:
```typescript
const { data: hasAccess } = await supabaseClient.rpc('has_outlet_access', {
  _user_id: user.id,
  _outlet_id: transfer.to_outlet_id
})

if (!hasAccess) {
  return new Response(
    JSON.stringify({ error: 'No access to receiving outlet' }),
    { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  )
}
```

With:
```typescript
const hasAccess = await hasInventoryAccess(supabaseClient, user.id, transfer.to_outlet_id)

if (!hasAccess) {
  return new Response(
    JSON.stringify({ error: 'No access to receiving outlet. You must be assigned as manager or staff of this outlet.' }),
    { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  )
}
```

## Access Matrix After Fix

| User Type | Create Transfer | Receive Transfer | Notes |
|-----------|-----------------|------------------|-------|
| Super Admin | ✅ All outlets | ✅ All outlets | Via `profiles.role` |
| Super Manager | ✅ All outlets | ✅ All outlets | Via `profiles.role` |
| Warehouse Manager | ✅ All outlets | ✅ All outlets | Via `profiles.role` |
| Store Manager (as manager_id) | ✅ Their outlet | ✅ Their outlet | Via `outlets.manager_id` |
| Store Manager (as outlet_staff) | ✅ Their outlet | ✅ Their outlet | Via `outlet_staff` (NEW!) |
| Staff with POS access | ✅ Their outlet | ✅ Their outlet | Via `outlet_staff` |
| Staff without POS access | ✅ Their outlet | ✅ Their outlet | Via `outlet_staff` (NEW!) |
| Unassigned users | ❌ | ❌ | No access |

## Technical Details

### Why This Approach?

1. **No database migration needed** - All changes are in the edge function
2. **Consistent with manage-stock** - The `manage-stock/index.ts` already uses this same pattern (lines 250-275)
3. **Separates POS from Inventory** - `can_access_pos` should only gate POS operations, not inventory management
4. **Future-proof** - Easy to add more role-based checks if needed

### Files Modified

| File | Changes |
|------|---------|
| `supabase/functions/stock-transfer-request/index.ts` | Add `hasInventoryAccess()` helper, update 2 access checks |

### Testing After Deployment

1. **Sami Ullah (Gulshan Outlet manager)** should be able to:
   - Open "New Transfer Request" dialog
   - Select products from warehouse
   - Submit the request successfully
   - Receive incoming transfers to Gulshan Outlet

2. **Any warehouse_manager** should have full access to all outlets

3. **Unassigned users** should still get 403 error

## Summary

This fix ensures that any user who is assigned to an outlet (whether as `manager_id` or via `outlet_staff` table, regardless of `can_access_pos` setting) can perform inventory operations for that outlet. Super roles (super_admin, super_manager, warehouse_manager) retain global access to all outlets.
