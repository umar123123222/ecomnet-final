-- Remove dispatch_status column from dispatches table as it's redundant with orders.status
-- Dispatches are events/logs, not stateful entities

ALTER TABLE dispatches DROP COLUMN IF EXISTS status;

-- Drop the dispatch_status enum as it's no longer needed
DROP TYPE IF EXISTS dispatch_status CASCADE;