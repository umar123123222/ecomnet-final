-- Add missing order status enum values to support all frontend status options
ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'received';
ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'pending_confirmation';
ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'pending_address';
ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'pending_dispatch';
ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'in_transit';
ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'out_for_delivery';
ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'return_marked';
ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'return_received';