-- Add supplier response fields to low_stock_notifications
ALTER TABLE public.low_stock_notifications 
ADD COLUMN IF NOT EXISTS supplier_can_supply boolean DEFAULT NULL,
ADD COLUMN IF NOT EXISTS supplier_available_qty integer DEFAULT NULL,
ADD COLUMN IF NOT EXISTS supplier_estimated_date date DEFAULT NULL,
ADD COLUMN IF NOT EXISTS supplier_notes text DEFAULT NULL;

-- Add supplier confirmation fields to purchase_orders
ALTER TABLE public.purchase_orders
ADD COLUMN IF NOT EXISTS supplier_confirmed boolean DEFAULT NULL,
ADD COLUMN IF NOT EXISTS supplier_confirmed_at timestamp with time zone DEFAULT NULL,
ADD COLUMN IF NOT EXISTS supplier_rejected boolean DEFAULT NULL,
ADD COLUMN IF NOT EXISTS supplier_rejected_reason text DEFAULT NULL,
ADD COLUMN IF NOT EXISTS supplier_delivery_date date DEFAULT NULL,
ADD COLUMN IF NOT EXISTS supplier_notes text DEFAULT NULL,
ADD COLUMN IF NOT EXISTS shipped_at timestamp with time zone DEFAULT NULL,
ADD COLUMN IF NOT EXISTS shipping_tracking text DEFAULT NULL,
ADD COLUMN IF NOT EXISTS received_at timestamp with time zone DEFAULT NULL;

-- Add lead time to supplier_products
ALTER TABLE public.supplier_products
ADD COLUMN IF NOT EXISTS lead_time_days integer DEFAULT 7;

-- Create table for supplier messages/communication on POs
CREATE TABLE IF NOT EXISTS public.po_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  po_id uuid NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES profiles(id),
  sender_type text NOT NULL CHECK (sender_type IN ('supplier', 'staff')),
  message text NOT NULL,
  created_at timestamp with time zone DEFAULT now()
);

-- Enable RLS on po_messages
ALTER TABLE public.po_messages ENABLE ROW LEVEL SECURITY;

-- RLS policies for po_messages
CREATE POLICY "Suppliers can view messages on their POs"
ON public.po_messages FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM purchase_orders po
    JOIN supplier_profiles sp ON sp.supplier_id = po.supplier_id
    WHERE po.id = po_messages.po_id AND sp.user_id = auth.uid()
  )
);

CREATE POLICY "Suppliers can send messages on their POs"
ON public.po_messages FOR INSERT
WITH CHECK (
  sender_id = auth.uid() AND
  EXISTS (
    SELECT 1 FROM purchase_orders po
    JOIN supplier_profiles sp ON sp.supplier_id = po.supplier_id
    WHERE po.id = po_messages.po_id AND sp.user_id = auth.uid()
  )
);

CREATE POLICY "Staff can view all PO messages"
ON public.po_messages FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role IN ('super_admin', 'super_manager', 'warehouse_manager')
    AND user_roles.is_active = true
  )
);

CREATE POLICY "Staff can send messages on POs"
ON public.po_messages FOR INSERT
WITH CHECK (
  sender_id = auth.uid() AND
  EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role IN ('super_admin', 'super_manager', 'warehouse_manager')
    AND user_roles.is_active = true
  )
);

-- Add RLS policies for suppliers to update low_stock_notifications
CREATE POLICY "Suppliers can update their notifications"
ON public.low_stock_notifications FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM supplier_profiles
    WHERE supplier_profiles.user_id = auth.uid()
    AND supplier_profiles.supplier_id = low_stock_notifications.supplier_id
  )
);

-- Add RLS policies for suppliers to update their purchase_orders
CREATE POLICY "Suppliers can update their POs"
ON public.purchase_orders FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM supplier_profiles
    WHERE supplier_profiles.user_id = auth.uid()
    AND supplier_profiles.supplier_id = purchase_orders.supplier_id
  )
);