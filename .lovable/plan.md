

# Comprehensive Audit: Suppliers & Inventory Modules

---

## CRITICAL ISSUES

### 1. Store Manager Cannot See Transfers Assigned via `outlet_staff`
- **Component:** `src/pages/StockTransfer/StockTransferDashboard.tsx` (lines 128-141)
- **Issue:** When filtering transfers for store managers, the query only checks `outlets.manager_id` but does NOT check the `outlet_staff` table. A store manager assigned via `outlet_staff` (not as `manager_id`) will see zero transfers.
- **Code:**
```typescript
const { data: userOutlets } = await supabase
  .from("outlets")
  .select("id")
  .or(`manager_id.eq.${profile.id}`);
```
- **Fix:** Add a parallel query to `outlet_staff` to find outlets where the user is assigned, then merge outlet IDs:
```typescript
const [managedResult, staffResult] = await Promise.all([
  supabase.from("outlets").select("id").eq("manager_id", profile.id),
  supabase.from("outlet_staff").select("outlet_id").eq("user_id", profile.id)
]);
const outletIds = [
  ...(managedResult.data?.map(o => o.id) || []),
  ...(staffResult.data?.map(o => o.outlet_id) || [])
];
// deduplicate and use in .in("to_outlet_id", outletIds) or .in("from_outlet_id", outletIds)
```

### 2. "Add Supplier" Button Has Hardcoded Padding Causing Overflow
- **Component:** `src/pages/Suppliers/SupplierManagement.tsx` (line 380)
- **Issue:** The button has `className="my-0 mx-0 px-[133px]"` which creates a massively wide button that overflows on mobile and looks wrong on desktop.
- **Fix:** Remove the hardcoded `px-[133px]` and let the button size naturally.

### 3. Supplier Form Submits Without Validating Required Fields Across Tabs
- **Component:** `src/pages/Suppliers/SupplierManagement.tsx` (lines 337-340, 646-824)
- **Issue:** The form uses HTML `required` attributes, but since the form is split across 3 tabs (Basic, Contact, Settings), a user can submit from the "Basic" tab without filling required fields in "Contact" tab. The browser's native validation may not catch fields in hidden tabs. No Zod schema is used for validation.
- **Fix:** Add Zod schema validation with `react-hook-form` (like PackagingManagement does) or add a pre-submit check that validates all tabs before submission.

### 4. `manage-stock` Edge Function Checks `user_roles` Table Instead of `profiles.role`
- **Component:** `supabase/functions/manage-stock/index.ts` (lines 240-246)
- **Issue:** The function queries `user_roles` table for role lookup, but based on the codebase architecture, roles are stored in `profiles.role`. If the `user_roles` table is not populated for all users, store managers and warehouse managers may be unable to adjust stock.
- **Fix:** Update the role check to use `profiles.role` instead of (or in addition to) `user_roles`, consistent with the fix applied to `stock-transfer-request`.

---

## MAJOR ISSUES

### 5. Supplier Analytics Table Not Responsive on Mobile
- **Component:** `src/pages/Suppliers/SupplierAnalyticsDashboard.tsx` (lines 307-385)
- **Issue:** The performance details table uses a plain HTML `<table>` with 10 columns and no mobile card view. On mobile, the table overflows horizontally and is unreadable. No `overflow-x-auto` wrapper exists.
- **Fix:** Add `overflow-x-auto` to the table wrapper (partially present at line 307) and consider adding a mobile card view like other pages.

### 6. Supplier Analytics Stats Grid Overflows on Mobile
- **Component:** `src/pages/Suppliers/SupplierAnalyticsDashboard.tsx` (line 173)
- **Issue:** The stats grid uses `lg:grid-cols-6` which on medium screens creates 2 columns of very narrow cards. On mobile (375px), 6 stat cards in a flex layout causes cramped display.
- **Fix:** Change to `grid-cols-2 md:grid-cols-3 lg:grid-cols-6` for better responsive breakpoints.

### 7. Supplier Search Does Not Filter by Contact Person, Email, or Phone
- **Component:** `src/pages/Suppliers/SupplierManagement.tsx` (line 341)
- **Issue:** `filteredSuppliers` only matches on `name` and `code`, ignoring `contact_person`, `email`, `phone`, and `city` which are displayed in the table.
- **Fix:** Extend the filter:
```typescript
const filteredSuppliers = suppliers.filter(supplier =>
  supplier.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
  supplier.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
  (supplier.contact_person || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
  (supplier.email || '').toLowerCase().includes(searchTerm.toLowerCase())
);
```

### 8. No Pagination on Supplier List or Inventory Table
- **Component:** `SupplierManagement.tsx`, `InventoryDashboard.tsx`
- **Issue:** Suppliers list fetches ALL suppliers with no pagination. The inventory table shows first 5 rows with a "Show All" toggle that loads everything at once. For businesses with 100+ suppliers or 500+ inventory records, this causes performance degradation.
- **Fix:** Implement server-side pagination with `.range()` for suppliers; use the existing `usePaginatedQuery` hook for inventory.

### 9. `handleEdit` Doesn't Populate `address` and `tax_id` Fields
- **Component:** `src/pages/Suppliers/SupplierManagement.tsx` (lines 316-335)
- **Issue:** When editing a supplier, `address` is always set to `''` and `tax_id` is always set to `''`. These fields are never populated from the existing supplier data because they're not in the fetched `suppliers` query or cast into the `Supplier` interface.
- **Fix:** Include `address` and `tax_id` in the supplier query `select` clause and update `handleEdit` to populate them: `address: (supplier as any).address || ''`.

---

## MINOR IMPROVEMENTS

### 10. Desktop Table Actions Hidden Until Hover
- **Component:** `src/pages/Suppliers/SupplierManagement.tsx` (line 606)
- **Issue:** Action buttons use `opacity-0 group-hover:opacity-100` which makes them invisible until hover. This is not discoverable on touch devices or for accessibility.
- **Fix:** Remove the opacity transition or add a "more" dropdown that is always visible.

### 11. Supplier Delete Doesn't Check `supplier_profiles` Auth Account
- **Component:** `src/pages/Suppliers/SupplierManagement.tsx` (lines 200-234)
- **Issue:** When deleting a supplier, the code deletes `supplier_profiles` records but doesn't delete the associated Supabase auth user account. Orphaned auth accounts remain.
- **Fix:** Call an edge function to properly clean up the auth user (requires admin key), or document this as expected behavior.

### 12. No Loading State for Grant Portal Access Button
- **Component:** `src/pages/Suppliers/SupplierManagement.tsx` (lines 600-602)
- **Issue:** On desktop, the "Grant" portal access button shows no spinner when `grantAccessMutation.isPending`. The mobile version handles this correctly.
- **Fix:** Add a `Loader2` spinner and disable the button when pending.

### 13. Inventory Dashboard Doesn't Show Deficit Count in Stats
- **Component:** `src/pages/Inventory/InventoryDashboard.tsx` (line 208)
- **Issue:** `deficitCount` is calculated but never displayed in the stats cards. Users with negative available quantities have no visual indicator at the summary level.
- **Fix:** Add a fourth stats card for deficit count when `deficitCount > 0`.

### 14. StockMovementHistory Fetches Profiles in Separate Queries
- **Component:** `src/pages/Inventory/StockMovementHistory.tsx` (lines 203-219)
- **Issue:** Profile enrichment does a separate query for user profiles. This could be optimized with a join or a foreign key relationship in the query.
- **Fix:** Use the existing profile join pattern: `created_by:profiles(full_name, email)` in the main select.

### 15. Stock Transfer Request - `from_outlet_id` Not Checked for Store Managers
- **Component:** `src/pages/StockTransfer/StockTransferDashboard.tsx` (line 137)
- **Issue:** Store managers only see transfers where `to_outlet_id` matches their outlet. They cannot see transfers where their outlet is the source (`from_outlet_id`).
- **Fix:** Use `.or()` to check both `to_outlet_id` and `from_outlet_id`:
```typescript
query = query.or(`to_outlet_id.in.(${outletIds.join(',')}),from_outlet_id.in.(${outletIds.join(',')})`);
```

---

## UI/UX SUGGESTIONS

### 16. Supplier Form Should Auto-Generate Code
- **Component:** `SupplierManagement.tsx` - Supplier Code field
- **Suggestion:** Auto-generate a supplier code (e.g., `SUP-001`) when adding a new supplier, with the option to override. Currently requires manual entry.

### 17. Supplier Rating is Not Editable
- **Component:** `SupplierManagement.tsx` - Edit Supplier Sheet
- **Suggestion:** The supplier rating is displayed but there's no way to update it through the edit form. Add a rating input (1-5 stars) to the form.

### 18. Inventory Dashboard is Overwhelming
- **Component:** `src/pages/Inventory/InventoryDashboard.tsx`
- **Suggestion:** The dashboard renders 15+ widget components on a single page (InventorySummary, StatsGrid, InventoryTable, SmartReorder, HealthScore, QuickActions, ProductStock, OutletStock, RecentAdjustments, LowStockAlerts, RecentMovements, PackagingInventory, PackagingAlerts, PendingTransfers, InventoryValue, StockAging, Insights, DemandForecast, SalesVelocity, ABC Analysis, Turnover, OutletComparison, StockMatrix, ReportGenerator). Consider lazy-loading below-the-fold widgets or splitting into sub-tabs.

### 19. Analytics Charts Have No Data Export Option
- **Component:** `SupplierAnalyticsDashboard.tsx`
- **Suggestion:** Add an "Export CSV" or "Download Report" button for the analytics data table so users can analyze supplier performance offline.

### 20. Stock Transfer Mobile View Missing
- **Component:** `src/pages/StockTransfer/StockTransferDashboard.tsx`
- **Suggestion:** The transfer table has no mobile card view. On mobile, the 6-column table with action buttons in a hover-to-show pattern is difficult to use. Add a mobile card layout similar to the order/supplier mobile views.

---

## Implementation Priority

| Priority | Issue | Effort |
|----------|-------|--------|
| P0 | #1 - Store manager outlet_staff transfers query | Small |
| P0 | #2 - Add Supplier button px-[133px] overflow | Trivial |
| P0 | #4 - manage-stock uses wrong role table | Small |
| P1 | #3 - Supplier form cross-tab validation | Medium |
| P1 | #5 - Analytics table mobile responsive | Medium |
| P1 | #7 - Supplier search scope | Small |
| P1 | #9 - Edit supplier missing address/tax_id | Small |
| P2 | #6 - Analytics stats grid responsive | Small |
| P2 | #8 - Pagination for large datasets | Medium |
| P2 | #10 - Desktop action visibility | Small |
| P2 | #15 - Store manager from_outlet visibility | Small |
| P3 | #11-14, #16-20 | Various |

