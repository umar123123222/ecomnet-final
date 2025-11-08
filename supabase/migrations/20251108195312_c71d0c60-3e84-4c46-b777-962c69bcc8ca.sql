-- Step 1: Create dispatch_status enum type
CREATE TYPE dispatch_status AS ENUM (
  'pending',
  'booked',
  'dispatched',
  'delivered',
  'failed',
  'cancelled'
);

-- Step 2: Drop the restrictive check constraint
ALTER TABLE public.dispatches 
DROP CONSTRAINT IF EXISTS dispatches_status_check;

-- Step 3: Remove the default temporarily
ALTER TABLE public.dispatches 
  ALTER COLUMN status DROP DEFAULT;

-- Step 4: Convert existing status column to use the new enum
ALTER TABLE public.dispatches 
  ALTER COLUMN status TYPE dispatch_status 
  USING CASE status
    WHEN 'pending' THEN 'pending'::dispatch_status
    WHEN 'booked' THEN 'booked'::dispatch_status
    WHEN 'dispatched' THEN 'dispatched'::dispatch_status
    WHEN 'delivered' THEN 'delivered'::dispatch_status
    WHEN 'failed' THEN 'failed'::dispatch_status
    WHEN 'cancelled' THEN 'cancelled'::dispatch_status
    ELSE 'pending'::dispatch_status
  END;

-- Step 5: Set the default value back
ALTER TABLE public.dispatches 
  ALTER COLUMN status SET DEFAULT 'pending'::dispatch_status;