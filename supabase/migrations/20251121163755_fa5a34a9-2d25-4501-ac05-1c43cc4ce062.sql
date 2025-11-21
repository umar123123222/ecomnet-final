-- Allow deleting users without violating NOT NULL on stock_movements.created_by
ALTER TABLE public.stock_movements
  ALTER COLUMN created_by DROP NOT NULL;