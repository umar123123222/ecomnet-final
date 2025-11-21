-- Fix update_order_status_tag to avoid referencing non-existent enum values like 'on_hold' or 'processing'
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

    -- Generate the new Ecomnet status tag only for known enum statuses
    status_tag := CASE NEW.status
      WHEN 'pending' THEN 'Ecomnet - Pending'
      WHEN 'confirmed' THEN 'Ecomnet - Confirmed'
      WHEN 'booked' THEN 'Ecomnet - Booked'
      WHEN 'dispatched' THEN 'Ecomnet - Dispatched'
      WHEN 'delivered' THEN 'Ecomnet - Delivered'
      WHEN 'returned' THEN 'Ecomnet - Returned'
      WHEN 'cancelled' THEN 'Ecomnet - Cancelled'
      ELSE 'Ecomnet - ' || INITCAP(NEW.status::text)
    END;

    -- Get existing tags
    existing_tags := COALESCE(NEW.tags, ARRAY[]::TEXT[]);

    -- Filter out old Ecomnet status tags
    filtered_tags := ARRAY(
      SELECT t
      FROM unnest(existing_tags) AS t
      WHERE t NOT LIKE 'Ecomnet - %'
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

-- Ensure trigger exists (idempotent)
DROP TRIGGER IF EXISTS update_order_status_tag_trigger ON public.orders;
CREATE TRIGGER update_order_status_tag_trigger
  BEFORE UPDATE ON public.orders
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION update_order_status_tag();