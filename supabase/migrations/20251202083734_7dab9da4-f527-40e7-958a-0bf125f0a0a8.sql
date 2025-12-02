
-- Fix dispatch records with 'Unknown' courier by syncing from orders table
UPDATE dispatches d
SET 
  courier = o.courier,
  updated_at = now()
FROM orders o
WHERE d.order_id = o.id
  AND (d.courier = 'Unknown' OR d.courier IS NULL)
  AND o.courier IS NOT NULL;

-- Add comment
COMMENT ON TABLE dispatches IS 'Dispatch records synced with order courier information';
