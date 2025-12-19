-- Backfill missing dispatch records for orders that have tracking_id and courier but no dispatch
INSERT INTO dispatches (order_id, courier, tracking_id, dispatch_date, created_at, updated_at)
SELECT 
  o.id as order_id,
  o.courier::text as courier,
  o.tracking_id,
  COALESCE(o.dispatched_at, o.booked_at, o.updated_at) as dispatch_date,
  COALESCE(o.booked_at, o.created_at) as created_at,
  NOW() as updated_at
FROM orders o
WHERE o.tracking_id IS NOT NULL
  AND o.courier IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM dispatches d WHERE d.order_id = o.id);