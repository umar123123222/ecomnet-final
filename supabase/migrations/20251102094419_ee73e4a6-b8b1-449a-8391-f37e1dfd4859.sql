-- Fix foreign key constraints to allow user deletion
-- Add ON DELETE SET NULL to all foreign keys referencing profiles(id)

-- Auto Purchase Orders
ALTER TABLE public.auto_purchase_orders
  DROP CONSTRAINT IF EXISTS auto_purchase_orders_created_by_fkey,
  ADD CONSTRAINT auto_purchase_orders_created_by_fkey 
    FOREIGN KEY (created_by) REFERENCES profiles(id) ON DELETE SET NULL;

-- Cash Drawer Events
ALTER TABLE public.cash_drawer_events
  DROP CONSTRAINT IF EXISTS cash_drawer_events_created_by_fkey,
  ADD CONSTRAINT cash_drawer_events_created_by_fkey 
    FOREIGN KEY (created_by) REFERENCES profiles(id) ON DELETE SET NULL;

-- Conversations
ALTER TABLE public.conversations
  DROP CONSTRAINT IF EXISTS conversations_created_by_fkey,
  ADD CONSTRAINT conversations_created_by_fkey 
    FOREIGN KEY (created_by) REFERENCES profiles(id) ON DELETE SET NULL;

-- Count Variances
ALTER TABLE public.count_variances
  DROP CONSTRAINT IF EXISTS count_variances_assigned_to_fkey,
  ADD CONSTRAINT count_variances_assigned_to_fkey 
    FOREIGN KEY (assigned_to) REFERENCES profiles(id) ON DELETE SET NULL;

ALTER TABLE public.count_variances
  DROP CONSTRAINT IF EXISTS count_variances_resolved_by_fkey,
  ADD CONSTRAINT count_variances_resolved_by_fkey 
    FOREIGN KEY (resolved_by) REFERENCES profiles(id) ON DELETE SET NULL;

-- Goods Received Notes
ALTER TABLE public.goods_received_notes
  DROP CONSTRAINT IF EXISTS goods_received_notes_received_by_fkey,
  ADD CONSTRAINT goods_received_notes_received_by_fkey 
    FOREIGN KEY (received_by) REFERENCES profiles(id) ON DELETE SET NULL;

ALTER TABLE public.goods_received_notes
  DROP CONSTRAINT IF EXISTS goods_received_notes_inspected_by_fkey,
  ADD CONSTRAINT goods_received_notes_inspected_by_fkey 
    FOREIGN KEY (inspected_by) REFERENCES profiles(id) ON DELETE SET NULL;

-- Orders
ALTER TABLE public.orders
  DROP CONSTRAINT IF EXISTS orders_assigned_to_fkey,
  ADD CONSTRAINT orders_assigned_to_fkey 
    FOREIGN KEY (assigned_to) REFERENCES profiles(id) ON DELETE SET NULL;

ALTER TABLE public.orders
  DROP CONSTRAINT IF EXISTS orders_verified_by_fkey,
  ADD CONSTRAINT orders_verified_by_fkey 
    FOREIGN KEY (verified_by) REFERENCES profiles(id) ON DELETE SET NULL;

-- Outlets
ALTER TABLE public.outlets
  DROP CONSTRAINT IF EXISTS outlets_manager_id_fkey,
  ADD CONSTRAINT outlets_manager_id_fkey 
    FOREIGN KEY (manager_id) REFERENCES profiles(id) ON DELETE SET NULL;

-- POS Receipts
ALTER TABLE public.pos_receipts
  DROP CONSTRAINT IF EXISTS pos_receipts_printed_by_fkey,
  ADD CONSTRAINT pos_receipts_printed_by_fkey 
    FOREIGN KEY (printed_by) REFERENCES profiles(id) ON DELETE SET NULL;

-- POS Sales
ALTER TABLE public.pos_sales
  DROP CONSTRAINT IF EXISTS pos_sales_voided_by_fkey,
  ADD CONSTRAINT pos_sales_voided_by_fkey 
    FOREIGN KEY (voided_by) REFERENCES profiles(id) ON DELETE SET NULL;

ALTER TABLE public.pos_sales
  DROP CONSTRAINT IF EXISTS pos_sales_cashier_id_fkey,
  ADD CONSTRAINT pos_sales_cashier_id_fkey 
    FOREIGN KEY (cashier_id) REFERENCES profiles(id) ON DELETE SET NULL;

-- POS Sessions
ALTER TABLE public.pos_sessions
  DROP CONSTRAINT IF EXISTS pos_sessions_cashier_id_fkey,
  ADD CONSTRAINT pos_sessions_cashier_id_fkey 
    FOREIGN KEY (cashier_id) REFERENCES profiles(id) ON DELETE SET NULL;

-- Purchase Orders
ALTER TABLE public.purchase_orders
  DROP CONSTRAINT IF EXISTS purchase_orders_approved_by_fkey,
  ADD CONSTRAINT purchase_orders_approved_by_fkey 
    FOREIGN KEY (approved_by) REFERENCES profiles(id) ON DELETE SET NULL;

ALTER TABLE public.purchase_orders
  DROP CONSTRAINT IF EXISTS purchase_orders_created_by_fkey,
  ADD CONSTRAINT purchase_orders_created_by_fkey 
    FOREIGN KEY (created_by) REFERENCES profiles(id) ON DELETE SET NULL;

-- Receiving Discrepancies
ALTER TABLE public.receiving_discrepancies
  DROP CONSTRAINT IF EXISTS receiving_discrepancies_reported_by_fkey,
  ADD CONSTRAINT receiving_discrepancies_reported_by_fkey 
    FOREIGN KEY (reported_by) REFERENCES profiles(id) ON DELETE SET NULL;

ALTER TABLE public.receiving_discrepancies
  DROP CONSTRAINT IF EXISTS receiving_discrepancies_resolved_by_fkey,
  ADD CONSTRAINT receiving_discrepancies_resolved_by_fkey 
    FOREIGN KEY (resolved_by) REFERENCES profiles(id) ON DELETE SET NULL;

-- Returns
ALTER TABLE public.returns
  DROP CONSTRAINT IF EXISTS returns_received_by_fkey,
  ADD CONSTRAINT returns_received_by_fkey 
    FOREIGN KEY (received_by) REFERENCES profiles(id) ON DELETE SET NULL;

-- Stock Count Items
ALTER TABLE public.stock_count_items
  DROP CONSTRAINT IF EXISTS stock_count_items_counted_by_fkey,
  ADD CONSTRAINT stock_count_items_counted_by_fkey 
    FOREIGN KEY (counted_by) REFERENCES profiles(id) ON DELETE SET NULL;

-- Stock Count Schedules
ALTER TABLE public.stock_count_schedules
  DROP CONSTRAINT IF EXISTS stock_count_schedules_assigned_to_fkey,
  ADD CONSTRAINT stock_count_schedules_assigned_to_fkey 
    FOREIGN KEY (assigned_to) REFERENCES profiles(id) ON DELETE SET NULL;

-- Stock Counts
ALTER TABLE public.stock_counts
  DROP CONSTRAINT IF EXISTS stock_counts_started_by_fkey,
  ADD CONSTRAINT stock_counts_started_by_fkey 
    FOREIGN KEY (started_by) REFERENCES profiles(id) ON DELETE SET NULL;

ALTER TABLE public.stock_counts
  DROP CONSTRAINT IF EXISTS stock_counts_approved_by_fkey,
  ADD CONSTRAINT stock_counts_approved_by_fkey 
    FOREIGN KEY (approved_by) REFERENCES profiles(id) ON DELETE SET NULL;

-- Stock Movements
ALTER TABLE public.stock_movements
  DROP CONSTRAINT IF EXISTS stock_movements_created_by_fkey,
  ADD CONSTRAINT stock_movements_created_by_fkey 
    FOREIGN KEY (created_by) REFERENCES profiles(id) ON DELETE SET NULL;

-- Stock Transfer Requests
ALTER TABLE public.stock_transfer_requests
  DROP CONSTRAINT IF EXISTS stock_transfer_requests_approved_by_fkey,
  ADD CONSTRAINT stock_transfer_requests_approved_by_fkey 
    FOREIGN KEY (approved_by) REFERENCES profiles(id) ON DELETE SET NULL;

ALTER TABLE public.stock_transfer_requests
  DROP CONSTRAINT IF EXISTS stock_transfer_requests_completed_by_fkey,
  ADD CONSTRAINT stock_transfer_requests_completed_by_fkey 
    FOREIGN KEY (completed_by) REFERENCES profiles(id) ON DELETE SET NULL;

ALTER TABLE public.stock_transfer_requests
  DROP CONSTRAINT IF EXISTS stock_transfer_requests_requested_by_fkey,
  ADD CONSTRAINT stock_transfer_requests_requested_by_fkey 
    FOREIGN KEY (requested_by) REFERENCES profiles(id) ON DELETE SET NULL;