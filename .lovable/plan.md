

## Plan: Shopify Delivery Status Check for Stuck Orders

### Overview
Add a "Check status with Shopify" bulk action that queries Shopify for selected orders' fulfillment/delivery status and automatically marks delivered ones in the ERP.

### Components to Change

**1. New Edge Function: `supabase/functions/check-shopify-delivery/index.ts`**

Accepts `{ orderIds: string[], userId: string, userName: string }` from the client.

Logic per batch:
- Query `orders` table for the given IDs, selecting `id, order_number, shopify_order_id, status`
- Skip orders without `shopify_order_id`
- Fetch Shopify credentials from `api_settings` table (same pattern as `backfill-shopify-fulfillments`)
- For each order, call Shopify Admin API `GET /orders/{shopify_order_id}.json`
- Check `fulfillment_status === 'fulfilled'` and look at `fulfillments[].status === 'success'` or shipment status
- If delivered/fulfilled: update `orders` set `status = 'delivered'`, `delivered_at = fulfillment.updated_at || now()`, `updated_at = now()`
- Insert `activity_logs` entry with `action = 'mark_delivered_shopify_sync'` and `details` containing `done_by: 'shopify'`, `requested_by_user_id`, `requested_by_user_name`, `marked_text: "done by shopify on request of <userName>"`, `shopify_status_snapshot`, `effective_datetime`, `marked_at`
- Return `{ updated, failed, failedIds, skippedNoShopifyId }`
- Use `fetchWithRetry` pattern and 600ms delay between Shopify API calls (same as existing functions)
- Process all order IDs in one invocation (edge function handles internally)

**2. Update `BulkSelectionBar` component**

Add new prop `onCheckShopify` and a new `DropdownMenuItem`:
- Icon: `RefreshCw` with text "Check status with Shopify"
- Calls `onCheckShopify` when clicked

**3. Update `StuckOrdersDashboard`**

- Add state: `shopifyCheckModalOpen` boolean
- Add `handleShopifyCheck` function:
  - Show confirmation via `AlertDialog` (not the BulkStatusUpdateModal — this needs different fields)
  - On confirm: call `supabase.functions.invoke('check-shopify-delivery', { body: { orderIds, userId: user.id, userName: profile?.full_name || user.email } })`
  - Process response: show toast with counts, refresh queries, clear selection (keep failed selected)
- Wire `onCheckShopify` prop to BulkSelectionBar
- Add a new confirmation dialog specifically for Shopify check (simple confirm dialog with description text, no date/notes fields needed)

**4. Register edge function in `supabase/config.toml`**

Add `[functions.check-shopify-delivery]` with `verify_jwt = false` (validate auth in code, consistent with other functions).

### Files Modified/Created

| File | Action |
|------|--------|
| `supabase/functions/check-shopify-delivery/index.ts` | Create |
| `supabase/config.toml` | Add function config |
| `src/components/stuck-orders/BulkSelectionBar.tsx` | Add Shopify action item |
| `src/pages/StuckOrders/StuckOrdersDashboard.tsx` | Add handler + confirmation dialog |

### Security
- Edge function uses `SUPABASE_SERVICE_ROLE_KEY` for DB operations (same as all other edge functions)
- Shopify credentials read from `api_settings` table (no browser exposure)
- Auth user ID passed from client, validated by Supabase auth header

