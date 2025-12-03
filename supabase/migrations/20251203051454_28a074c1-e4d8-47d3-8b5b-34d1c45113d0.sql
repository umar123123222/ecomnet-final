-- Fix affected orders: restore dispatched status for orders that were dispatched but reverted to booked
-- These orders were dispatched on Nov 29 but re-booked on Dec 2-3 which incorrectly reset their status
UPDATE orders 
SET status = 'dispatched', updated_at = NOW()
WHERE status = 'booked'
  AND dispatched_at IS NOT NULL
  AND booked_at IS NOT NULL
  AND dispatched_at < booked_at;

-- Also sync dispatch records to update courier from 'Unknown' to actual courier
UPDATE dispatches d
SET 
  courier = o.courier::text,
  tracking_id = COALESCE(d.tracking_id, o.tracking_id),
  updated_at = NOW()
FROM orders o
WHERE d.order_id = o.id
  AND d.courier = 'Unknown'
  AND o.courier IS NOT NULL;