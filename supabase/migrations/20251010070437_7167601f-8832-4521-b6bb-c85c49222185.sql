-- Step 1: Add new role values to enum (must be in separate transaction)
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'super_admin';
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'super_manager';
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'warehouse_manager';