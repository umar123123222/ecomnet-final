-- Remove duplicate foreign key constraint from user_performance table
ALTER TABLE user_performance 
DROP CONSTRAINT IF EXISTS user_performance_user_id_fkey;