-- Performance Optimization Indexes for high-traffic queries

-- Orders table composite indexes for common filter combinations
CREATE INDEX IF NOT EXISTS idx_orders_status_created_at ON orders (status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_courier_status ON orders (courier, status);
CREATE INDEX IF NOT EXISTS idx_orders_status_city ON orders (status, city);
CREATE INDEX IF NOT EXISTS idx_orders_customer_id_status ON orders (customer_id, status);

-- Order items composite index for bundle queries
CREATE INDEX IF NOT EXISTS idx_order_items_bundle_name ON order_items (bundle_name) WHERE bundle_name IS NOT NULL AND bundle_name != '';
CREATE INDEX IF NOT EXISTS idx_order_items_order_bundle ON order_items (order_id, bundle_name);

-- Inventory composite indexes
CREATE INDEX IF NOT EXISTS idx_inventory_outlet_product ON inventory (outlet_id, product_id);
CREATE INDEX IF NOT EXISTS idx_inventory_product_available ON inventory (product_id, available_quantity) WHERE available_quantity > 0;

-- Stock movements composite index
CREATE INDEX IF NOT EXISTS idx_stock_movements_product_outlet_date ON stock_movements (product_id, outlet_id, created_at DESC);

-- Dispatches composite indexes
CREATE INDEX IF NOT EXISTS idx_dispatches_order_tracking ON dispatches (order_id, tracking_id);
CREATE INDEX IF NOT EXISTS idx_dispatches_tracking_lookup ON dispatches (tracking_id) WHERE tracking_id IS NOT NULL;

-- Returns composite index (using return_status instead of status)
CREATE INDEX IF NOT EXISTS idx_returns_order_return_status ON returns (order_id, return_status);

-- Profiles index for lookups
CREATE INDEX IF NOT EXISTS idx_profiles_email_lower ON profiles (LOWER(email));

-- Sync queue performance index
CREATE INDEX IF NOT EXISTS idx_sync_queue_pending ON sync_queue (status, created_at) WHERE status = 'pending';

-- Partial index for active products only
CREATE INDEX IF NOT EXISTS idx_products_active_name ON products (name) WHERE is_active = true;