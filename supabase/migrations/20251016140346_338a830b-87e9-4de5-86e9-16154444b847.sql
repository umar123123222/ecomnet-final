-- Phase 1A: Add supplier enum value (must be separate transaction)

DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role' AND typcategory = 'E') THEN
    CREATE TYPE user_role AS ENUM ('super_admin', 'super_manager', 'warehouse_manager', 'staff', 'supplier');
  ELSE
    BEGIN
      ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'supplier';
    EXCEPTION
      WHEN duplicate_object THEN NULL;
    END;
  END IF;
END $$;