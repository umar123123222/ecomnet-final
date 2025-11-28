-- Create unique constraint on courier_tracking_history to allow proper upsert operations
CREATE UNIQUE INDEX IF NOT EXISTS idx_tracking_history_unique 
ON courier_tracking_history (tracking_id, checked_at, status);

-- Add comment explaining the constraint
COMMENT ON INDEX idx_tracking_history_unique IS 'Unique constraint for upserting tracking events without duplicates';