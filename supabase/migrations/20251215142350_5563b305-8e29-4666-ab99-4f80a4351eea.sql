-- Fix Security Definer Views by adding security_invoker = true

-- Recreate product_stock_summary view with security_invoker
DROP VIEW IF EXISTS public.product_stock_summary;
CREATE VIEW public.product_stock_summary
WITH (security_invoker = true)
AS
SELECT p.id AS product_id,
    p.name,
    p.sku,
    p.price,
    p.cost,
    COALESCE(sum(i.quantity), (0)::bigint) AS total_stock,
    COALESCE(sum(i.reserved_quantity), (0)::bigint) AS committed_stock,
    COALESCE(sum(i.available_quantity), (0)::bigint) AS available_stock,
    count(DISTINCT i.outlet_id) AS outlet_count,
    COALESCE(sum(((i.quantity)::numeric * p.price)), (0)::numeric) AS total_value
FROM (products p
    LEFT JOIN inventory i ON ((i.product_id = p.id)))
WHERE (p.is_active = true)
GROUP BY p.id, p.name, p.sku, p.price, p.cost;

-- Recreate outlet_stock_summary view with security_invoker
DROP VIEW IF EXISTS public.outlet_stock_summary;
CREATE VIEW public.outlet_stock_summary
WITH (security_invoker = true)
AS
SELECT o.id AS outlet_id,
    o.name AS outlet_name,
    o.outlet_type,
    count(DISTINCT i.product_id) AS product_count,
    COALESCE(sum(i.quantity), (0)::bigint) AS total_units,
    COALESCE(sum(i.reserved_quantity), (0)::bigint) AS reserved_units,
    COALESCE(sum(i.available_quantity), (0)::bigint) AS available_units,
    COALESCE(sum(((i.quantity)::numeric * p.price)), (0)::numeric) AS total_value
FROM ((outlets o
    LEFT JOIN inventory i ON ((i.outlet_id = o.id)))
    LEFT JOIN products p ON ((p.id = i.product_id)))
WHERE (o.is_active = true)
GROUP BY o.id, o.name, o.outlet_type;

-- Fix functions missing search_path

-- Fix sync_order_to_shopify
CREATE OR REPLACE FUNCTION public.sync_order_to_shopify()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
BEGIN
  -- Only sync if order has shopify_order_id (already synced to Shopify)
  IF NEW.shopify_order_id IS NOT NULL THEN
    -- Insert into sync_queue for async processing
    INSERT INTO sync_queue (
      entity_type,
      entity_id,
      action,
      direction,
      payload,
      status
    ) VALUES (
      'order',
      NEW.id,
      'update',
      'to_shopify',
      jsonb_build_object(
        'order_id', NEW.id,
        'shopify_order_id', NEW.shopify_order_id,
        'changes', jsonb_build_object(
          'status', NEW.status,
          'tracking_id', NEW.tracking_id,
          'customer_address', NEW.customer_address,
          'customer_new_address', NEW.customer_new_address,
          'city', NEW.city,
          'tags', NEW.tags,
          'notes', NEW.notes,
          'customer_name', NEW.customer_name,
          'customer_phone', NEW.customer_phone
        )
      ),
      'pending'
    );
  END IF;
  RETURN NEW;
END;
$function$;

-- Fix sync_order_tracking_to_dispatch
CREATE OR REPLACE FUNCTION public.sync_order_tracking_to_dispatch()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- When order's tracking_id is updated, sync to dispatch if dispatch has no tracking
  IF NEW.tracking_id IS NOT NULL AND NEW.tracking_id != '' AND 
     (OLD.tracking_id IS NULL OR OLD.tracking_id = '' OR OLD.tracking_id != NEW.tracking_id) THEN
    
    UPDATE dispatches 
    SET 
      tracking_id = NEW.tracking_id,
      courier = COALESCE(dispatches.courier, NEW.courier::text),
      updated_at = NOW()
    WHERE order_id = NEW.id
      AND (tracking_id IS NULL OR tracking_id = '');
  END IF;
  
  -- When order's courier is updated, sync to dispatch if dispatch has no courier
  IF NEW.courier IS NOT NULL AND 
     (OLD.courier IS NULL OR OLD.courier != NEW.courier) THEN
    
    UPDATE dispatches 
    SET 
      courier = NEW.courier::text,
      updated_at = NOW()
    WHERE order_id = NEW.id
      AND (courier IS NULL OR courier = '');
  END IF;
  
  RETURN NEW;
END;
$function$;

-- Fix sync_profile_role_on_user_role_change
CREATE OR REPLACE FUNCTION public.sync_profile_role_on_user_role_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
    -- Update profile role to match the active user_role
    IF NEW.is_active = true THEN
      UPDATE profiles 
      SET role = NEW.role
      WHERE id = NEW.user_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;