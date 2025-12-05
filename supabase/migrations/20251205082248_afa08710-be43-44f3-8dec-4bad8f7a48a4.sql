
-- Delete duplicate tracking history records, keeping only the first occurrence
-- of each status+location combination per tracking_id
WITH ranked AS (
  SELECT 
    id,
    ROW_NUMBER() OVER (
      PARTITION BY tracking_id, status, current_location 
      ORDER BY checked_at ASC
    ) as rn
  FROM courier_tracking_history
)
DELETE FROM courier_tracking_history
WHERE id IN (
  SELECT id FROM ranked WHERE rn > 1
);
