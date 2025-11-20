-- Clean up sync_queue: Delete all items older than today (Nov 20, 2025)
-- This removes ~7,338 stuck items from November 7 that were blocking the queue
-- Keeps today's 598 pending items which can then process normally

DELETE FROM sync_queue
WHERE created_at < '2025-11-20';