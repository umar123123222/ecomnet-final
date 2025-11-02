-- Make user reference columns nullable in purchase_orders to allow user deletion
ALTER TABLE public.purchase_orders 
  ALTER COLUMN created_by DROP NOT NULL;

ALTER TABLE public.purchase_orders 
  ALTER COLUMN approved_by DROP NOT NULL;