-- Drop duplicate foreign key constraints from dispatches table
ALTER TABLE dispatches 
DROP CONSTRAINT IF EXISTS fk_dispatches_order;

-- Drop duplicate foreign key constraints from returns table
ALTER TABLE returns 
DROP CONSTRAINT IF EXISTS fk_returns_order;

-- The standard Supabase naming convention constraints will remain:
-- dispatches_order_id_fkey and returns_order_id_fkey