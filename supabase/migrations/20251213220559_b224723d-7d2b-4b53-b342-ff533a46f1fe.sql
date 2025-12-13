-- Add columns for supplier payment confirmation
ALTER TABLE purchase_orders 
ADD COLUMN IF NOT EXISTS supplier_payment_confirmed BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS supplier_payment_confirmed_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS supplier_payment_confirmed_notes TEXT;