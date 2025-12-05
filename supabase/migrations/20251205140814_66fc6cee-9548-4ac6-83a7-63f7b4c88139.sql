-- Add foreign key constraint so Supabase can resolve the nested relationship
ALTER TABLE courier_tracking_history 
ADD CONSTRAINT fk_courier_tracking_history_dispatch 
FOREIGN KEY (dispatch_id) REFERENCES dispatches(id) ON DELETE CASCADE;