# Shopify Integration Guide

## Overview

Your ERP system now has **100% bidirectional synchronization** with Shopify. Orders, inventory, products, and customers sync automatically in real-time.

## Quick Setup

### 1. Configure Shopify Credentials

Navigate to **Business Settings → Shopify Tab** and enter:

- **Store URL**: `your-store.myshopify.com` (without https://)
- **API Version**: `2024-01` (or your preferred version)
- **Default Location ID**: Your Shopify location ID for inventory sync

### 2. Store Access Token in Supabase Secrets

The Admin API Access Token must be stored in Supabase Secrets for security:

1. Go to: https://supabase.com/dashboard/project/lzitfcigdjbpymvebipp/settings/functions
2. Add secret: `SHOPIFY_ADMIN_API_TOKEN` with your Shopify access token
3. Test the connection using the "Test Connection" button

### 3. Configure Auto-Sync Settings

Enable/disable automatic synchronization for:

- ✅ **Auto-sync Orders** - Creates and updates orders in Shopify
- ⚪ **Auto-sync Inventory** - Updates stock levels in Shopify
- ⚪ **Auto-sync Products** - Syncs product changes to Shopify
- ⚪ **Auto-sync Customers** - Syncs customer data with Shopify

### 4. Register Webhooks

Click **"Register Webhooks"** to enable real-time sync from Shopify → Your ERP:

- `orders/updated` - Order status changes
- `orders/fulfilled` - Order fulfillment
- `orders/cancelled` - Order cancellations
- `inventory_levels/update` - Inventory changes
- `products/update` - Product updates
- `products/create` - New products

## How It Works

### Orders: Your ERP → Shopify

When you create/update an order in your ERP:

1. Order saved to database
2. Trigger fires → adds to `sync_queue` (if auto-sync enabled)
3. Background processor picks it up
4. Edge function `create-shopify-order` creates the order in Shopify
5. Shopify order ID linked back to your order
6. Status updates automatically

### Orders: Shopify → Your ERP

When an order is created/updated in Shopify:

1. Shopify sends webhook to `handle-shopify-order-update`
2. Webhook verified with HMAC signature
3. Order status/tracking updated in your database
4. Customer record created/updated
5. Sync logged

### Inventory: Your ERP → Shopify

When stock changes in your ERP:

1. Inventory updated in database
2. Trigger fires → adds to `sync_queue` (if auto-sync enabled)
3. Background processor batches updates (every 5 minutes)
4. Edge function `sync-inventory-to-shopify` updates Shopify
5. Shopify inventory levels updated

### Inventory: Shopify → Your ERP

When inventory changes in Shopify:

1. Shopify sends webhook to `handle-shopify-inventory-update`
2. Product found by `shopify_inventory_item_id`
3. Local inventory updated
4. Sync logged

## Sync Queue System

All sync operations go through a queue for reliability:

- **Automatic Processing**: Runs every 5 minutes via `scheduled-sync-processor`
- **Manual Processing**: Click "Process Sync Queue" button
- **Retry Logic**: Failed items retry up to 5 times with exponential backoff
- **Error Alerts**: Super admins notified after 3+ failures

### Queue Status

Monitor in Business Settings:

- **Pending**: Waiting to be processed
- **Processing**: Currently syncing
- **Completed**: Successfully synced
- **Failed**: Needs attention (check error message)

## Manual Actions

### Register Webhooks

Sets up real-time sync from Shopify. Click this after:

- Initial setup
- Changing webhook URLs
- Adding new sync types

### Process Sync Queue

Manually processes pending sync items. Use when:

- Testing the integration
- Clearing a backlog
- Troubleshooting sync issues

### Full Sync from Shopify

Imports all data from Shopify:

- All products
- All orders (last 60 days)
- All customers

**Warning**: This can take time for large stores!

## Monitoring & Logs

### Real-time Dashboard

Shows live sync statistics (last 24 hours):

- Total sync operations
- Success rate
- Failed operations
- Pending queue items

### Webhook Status

Lists all registered webhooks:

- Active/Inactive status
- Last triggered time
- Webhook topic

### Sync Activity Log

Detailed log of recent operations:

- Operation type (order, inventory, product)
- Status (success, failed, processing)
- Records processed
- Timestamp
- Auto-refreshes every 30 seconds

## Database Schema

### New Tables

**`sync_queue`** - Pending sync operations

- `entity_type`: order, product, customer, inventory
- `action`: create, update, delete
- `direction`: to_shopify, from_shopify
- `status`: pending, processing, completed, failed
- `retry_count`: Number of retry attempts
- `error_message`: Last error (if failed)

**`shopify_webhook_registry`** - Registered webhooks

- `webhook_id`: Shopify webhook ID
- `topic`: Webhook topic
- `status`: active, inactive, error
- `last_triggered`: Last webhook received

### Extended Tables

**`orders`** - Added sync tracking

- `shopify_sync_status`: pending, synced, failed, disabled
- `shopify_last_sync_at`: Last sync timestamp

**`inventory`** - Added Shopify fields

- `last_shopify_sync`: Last sync timestamp
- `shopify_location_id`: Shopify location for this inventory

**`products`** - Added Shopify fields

- `shopify_inventory_item_id`: For inventory sync
- `sync_to_shopify`: Enable/disable per-product sync

## Edge Functions

### Sync Functions (Authenticated)

- `create-shopify-order` - Creates orders in Shopify
- `sync-inventory-to-shopify` - Updates inventory in Shopify
- `register-shopify-webhooks` - Registers all webhooks
- `process-sync-queue` - Processes pending sync items

### Webhook Handlers (Public)

- `handle-shopify-order-update` - Receives order updates
- `handle-shopify-inventory-update` - Receives inventory updates
- `handle-shopify-product-update` - Receives product updates

### Scheduled Functions

- `scheduled-sync-processor` - Runs every 5 minutes to process queue

## Troubleshooting

### Orders Not Syncing to Shopify

1. Check auto-sync is enabled
2. Verify Shopify credentials in secrets
3. Check sync queue for errors
4. Review sync logs for error messages

### Webhooks Not Working

1. Verify webhooks are registered (check webhook status)
2. Check webhook secret in Supabase Secrets: `SHOPIFY_WEBHOOK_SECRET`
3. Review edge function logs for webhook signature errors
4. Re-register webhooks if needed

### Inventory Out of Sync

1. Ensure `SHOPIFY_DEFAULT_LOCATION_ID` is set
2. Check products have `shopify_inventory_item_id`
3. Enable auto-sync inventory if desired
4. Manually trigger sync via "Process Sync Queue"

### High Failure Rate

1. Check Shopify API rate limits
2. Review failed items in sync queue
3. Verify Shopify permissions (API scopes)
4. Check network connectivity to Shopify

## Best Practices

### Performance

- Enable auto-sync only for needed entities
- Use webhook handlers for real-time updates
- Let scheduled processor handle batch operations
- Monitor queue size and failure rates

### Security

- Always store API tokens in Supabase Secrets
- Verify webhook signatures (HMAC)
- Use least-privilege API scopes
- Regularly rotate access tokens

### Reliability

- Monitor sync logs daily
- Act on failed queue items promptly
- Re-register webhooks after changes
- Test in staging before enabling auto-sync

## API Settings

All settings stored in `api_settings` table:

- `SHOPIFY_STORE_URL`
- `SHOPIFY_API_VERSION`
- `SHOPIFY_AUTO_SYNC_ORDERS`
- `SHOPIFY_AUTO_SYNC_INVENTORY`
- `SHOPIFY_AUTO_SYNC_PRODUCTS`
- `SHOPIFY_AUTO_SYNC_CUSTOMERS`
- `SHOPIFY_DEFAULT_LOCATION_ID`

Secrets in Supabase:

- `SHOPIFY_ADMIN_API_TOKEN`
- `SHOPIFY_WEBHOOK_SECRET`

## Support & Maintenance

### Regular Checks

- Weekly: Review sync failure rate
- Monthly: Check webhook health
- Quarterly: Review and clean sync logs

### Updates

- Monitor Shopify API version deprecations
- Update API version in settings when needed
- Test new features in development first

---

**Your Shopify integration is fully operational! 🎉**

All synchronization happens automatically in the background. Monitor the dashboard in Business Settings to ensure everything runs smoothly.