-- Create trigger to update local order tags when status changes
-- This keeps the local database in sync with what will be sent to Shopify

CREATE OR REPLACE FUNCTION public.update_order_status_tag()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  status_tag TEXT;
  existing_tags TEXT[];
  filtered_tags TEXT[];
  new_tags TEXT[];
BEGIN
  -- Only update tags if status changed
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    
    -- Generate the new Ecomnet status tag
    status_tag := CASE NEW.status
      WHEN 'pending' THEN 'Ecomnet - Pending'
      WHEN 'confirmed' THEN 'Ecomnet - Confirmed'
      WHEN 'booked' THEN 'Ecomnet - Booked'
      WHEN 'dispatched' THEN 'Ecomnet - Dispatched'
      WHEN 'delivered' THEN 'Ecomnet - Delivered'
      WHEN 'returned' THEN 'Ecomnet - Returned'
      WHEN 'cancelled' THEN 'Ecomnet - Cancelled'
      WHEN 'on_hold' THEN 'Ecomnet - On Hold'
      WHEN 'processing' THEN 'Ecomnet - Processing'
      ELSE 'Ecomnet - ' || INITCAP(NEW.status)
    END;
    
    -- Get existing tags
    existing_tags := COALESCE(NEW.tags, ARRAY[]::TEXT[]);
    
    -- Filter out old Ecomnet status tags
    filtered_tags := ARRAY(
      SELECT unnest(existing_tags) 
      WHERE unnest NOT LIKE 'Ecomnet - %'
    );
    
    -- Add the new status tag
    new_tags := filtered_tags || ARRAY[status_tag];
    
    -- Update the tags
    NEW.tags := new_tags;
    
    RAISE NOTICE 'Updated order % tags: % -> %', NEW.order_number, existing_tags, new_tags;
  END IF;
  
  RETURN NEW;
END;
$function$;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS update_order_status_tag_trigger ON public.orders;

-- Create the trigger to run BEFORE UPDATE
-- This runs before the queue_order_status_sync trigger
CREATE TRIGGER update_order_status_tag_trigger
  BEFORE UPDATE ON public.orders
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION update_order_status_tag();