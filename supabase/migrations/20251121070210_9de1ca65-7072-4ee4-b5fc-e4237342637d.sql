-- Add index for Returns Not Received query
CREATE INDEX IF NOT EXISTS idx_dispatches_returned_status 
  ON dispatches(status, last_tracking_update) 
  WHERE status = 'returned';