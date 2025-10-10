-- Fix critical RLS issues - Part 2: Product table and Performance Indexes

-- 1. Enable RLS on product table and add policies
ALTER TABLE public.product ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can view products" ON public.product;
DROP POLICY IF EXISTS "Admins can manage products" ON public.product;

CREATE POLICY "Authenticated users can view products"
  ON public.product
  FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins can manage products"
  ON public.product
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('super_admin', 'super_manager')
    )
  );

-- 2. Add performance indexes for frequently queried columns
CREATE INDEX IF NOT EXISTS idx_orders_status ON public.orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_customer_id ON public.orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON public.orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_tracking_id ON public.orders(tracking_id);

CREATE INDEX IF NOT EXISTS idx_dispatches_courier ON public.dispatches(courier);
CREATE INDEX IF NOT EXISTS idx_dispatches_status ON public.dispatches(status);
CREATE INDEX IF NOT EXISTS idx_dispatches_order_id ON public.dispatches(order_id);

CREATE INDEX IF NOT EXISTS idx_returns_status ON public.returns(return_status);
CREATE INDEX IF NOT EXISTS idx_returns_order_id ON public.returns(order_id);

CREATE INDEX IF NOT EXISTS idx_inventory_outlet_id ON public.inventory(outlet_id);
CREATE INDEX IF NOT EXISTS idx_inventory_product_id ON public.inventory(product_id);

CREATE INDEX IF NOT EXISTS idx_stock_movements_product_id ON public.stock_movements(product_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_outlet_id ON public.stock_movements(outlet_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_created_at ON public.stock_movements(created_at DESC);