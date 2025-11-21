-- Step 1: Add 'confirmed' to order_status enum (must be in separate transaction)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum 
    WHERE enumlabel = 'confirmed' 
    AND enumtypid = 'order_status'::regtype
  ) THEN
    -- Add 'confirmed' between 'pending' and 'booked'
    -- First we need to get the oid of 'booked'
    EXECUTE 'ALTER TYPE order_status ADD VALUE IF NOT EXISTS ''confirmed'' BEFORE ''booked''';
  END IF;
END
$$;