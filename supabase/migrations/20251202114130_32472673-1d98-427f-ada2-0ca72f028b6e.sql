-- Step 1: Create merge function that extracts data before deleting
CREATE OR REPLACE FUNCTION public.merge_duplicate_customers_final()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  customer_record RECORD;
  primary_customer_id UUID;
  duplicate_ids UUID[];
  v_shopify_id BIGINT;
  v_email TEXT;
  v_address TEXT;
  v_city TEXT;
  v_phone TEXT;
  v_total_orders INT;
  v_delivered_count INT;
  v_return_count INT;
BEGIN
  -- Find duplicates by normalized phone
  FOR customer_record IN
    SELECT 
      normalize_phone(phone) as normalized_phone,
      ARRAY_AGG(id ORDER BY created_at ASC) as customer_ids
    FROM customers
    WHERE phone IS NOT NULL AND phone != ''
    GROUP BY normalize_phone(phone)
    HAVING COUNT(*) > 1
  LOOP
    primary_customer_id := customer_record.customer_ids[1];
    duplicate_ids := customer_record.customer_ids[2:];
    
    -- Extract data from primary and duplicates BEFORE deleting
    SELECT 
      COALESCE(
        (SELECT shopify_customer_id FROM customers WHERE id = primary_customer_id),
        (SELECT shopify_customer_id FROM customers WHERE id = ANY(duplicate_ids) AND shopify_customer_id IS NOT NULL LIMIT 1)
      ),
      COALESCE(
        (SELECT email FROM customers WHERE id = primary_customer_id),
        (SELECT email FROM customers WHERE id = ANY(duplicate_ids) AND email IS NOT NULL AND email != '' LIMIT 1)
      ),
      COALESCE(
        (SELECT address FROM customers WHERE id = primary_customer_id),
        (SELECT address FROM customers WHERE id = ANY(duplicate_ids) AND address IS NOT NULL LIMIT 1)
      ),
      COALESCE(
        (SELECT city FROM customers WHERE id = primary_customer_id),
        (SELECT city FROM customers WHERE id = ANY(duplicate_ids) AND city IS NOT NULL LIMIT 1)
      ),
      (SELECT SUM(total_orders) FROM customers WHERE id = primary_customer_id OR id = ANY(duplicate_ids)),
      (SELECT SUM(COALESCE(delivered_count, 0)) FROM customers WHERE id = primary_customer_id OR id = ANY(duplicate_ids)),
      (SELECT SUM(COALESCE(return_count, 0)) FROM customers WHERE id = primary_customer_id OR id = ANY(duplicate_ids))
    INTO v_shopify_id, v_email, v_address, v_city, v_total_orders, v_delivered_count, v_return_count;
    
    -- Update related records to point to primary
    UPDATE orders SET customer_id = primary_customer_id WHERE customer_id = ANY(duplicate_ids);
    UPDATE order_confirmations SET customer_id = primary_customer_id WHERE customer_id = ANY(duplicate_ids);
    UPDATE conversations SET customer_id = primary_customer_id WHERE customer_id = ANY(duplicate_ids);
    
    -- DELETE duplicates first
    DELETE FROM customers WHERE id = ANY(duplicate_ids);
    
    -- Now update primary with extracted data (no conflict since duplicates are gone)
    UPDATE customers
    SET
      email = COALESCE(v_email, email),
      address = COALESCE(v_address, address),
      city = COALESCE(v_city, city),
      shopify_customer_id = COALESCE(v_shopify_id, shopify_customer_id),
      total_orders = v_total_orders,
      delivered_count = v_delivered_count,
      return_count = v_return_count,
      updated_at = NOW()
    WHERE id = primary_customer_id;
    
    RAISE NOTICE 'Merged % duplicate customers for phone %', array_length(duplicate_ids, 1), customer_record.normalized_phone;
  END LOOP;
  
  -- Find duplicates by email (for customers without phone)
  FOR customer_record IN
    SELECT 
      LOWER(TRIM(email)) as normalized_email,
      ARRAY_AGG(id ORDER BY created_at ASC) as customer_ids
    FROM customers
    WHERE (phone IS NULL OR phone = '') 
      AND email IS NOT NULL 
      AND email != ''
    GROUP BY LOWER(TRIM(email))
    HAVING COUNT(*) > 1
  LOOP
    primary_customer_id := customer_record.customer_ids[1];
    duplicate_ids := customer_record.customer_ids[2:];
    
    -- Extract data BEFORE deleting
    SELECT 
      COALESCE(
        (SELECT shopify_customer_id FROM customers WHERE id = primary_customer_id),
        (SELECT shopify_customer_id FROM customers WHERE id = ANY(duplicate_ids) AND shopify_customer_id IS NOT NULL LIMIT 1)
      ),
      COALESCE(
        (SELECT phone FROM customers WHERE id = primary_customer_id),
        (SELECT phone FROM customers WHERE id = ANY(duplicate_ids) AND phone IS NOT NULL AND phone != '' LIMIT 1)
      ),
      COALESCE(
        (SELECT address FROM customers WHERE id = primary_customer_id),
        (SELECT address FROM customers WHERE id = ANY(duplicate_ids) AND address IS NOT NULL LIMIT 1)
      ),
      COALESCE(
        (SELECT city FROM customers WHERE id = primary_customer_id),
        (SELECT city FROM customers WHERE id = ANY(duplicate_ids) AND city IS NOT NULL LIMIT 1)
      ),
      (SELECT SUM(total_orders) FROM customers WHERE id = primary_customer_id OR id = ANY(duplicate_ids)),
      (SELECT SUM(COALESCE(delivered_count, 0)) FROM customers WHERE id = primary_customer_id OR id = ANY(duplicate_ids)),
      (SELECT SUM(COALESCE(return_count, 0)) FROM customers WHERE id = primary_customer_id OR id = ANY(duplicate_ids))
    INTO v_shopify_id, v_phone, v_address, v_city, v_total_orders, v_delivered_count, v_return_count;
    
    -- Update related records
    UPDATE orders SET customer_id = primary_customer_id WHERE customer_id = ANY(duplicate_ids);
    UPDATE order_confirmations SET customer_id = primary_customer_id WHERE customer_id = ANY(duplicate_ids);
    UPDATE conversations SET customer_id = primary_customer_id WHERE customer_id = ANY(duplicate_ids);
    
    -- DELETE duplicates
    DELETE FROM customers WHERE id = ANY(duplicate_ids);
    
    -- Update primary
    UPDATE customers
    SET
      phone = COALESCE(v_phone, phone),
      address = COALESCE(v_address, address),
      city = COALESCE(v_city, city),
      shopify_customer_id = COALESCE(v_shopify_id, shopify_customer_id),
      total_orders = v_total_orders,
      delivered_count = v_delivered_count,
      return_count = v_return_count,
      updated_at = NOW()
    WHERE id = primary_customer_id;
    
    RAISE NOTICE 'Merged % duplicate customers for email %', array_length(duplicate_ids, 1), customer_record.normalized_email;
  END LOOP;
END;
$function$;

-- Step 2: Execute the merge
SELECT public.merge_duplicate_customers_final();

-- Step 3: Update trigger to skip if customer_id already set
CREATE OR REPLACE FUNCTION public.ensure_customer_and_link()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_phone text;
  v_customer_id uuid;
BEGIN
  -- SKIP if customer_id is already set (webhook already handled it)
  IF NEW.customer_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  v_phone := normalize_phone(NEW.customer_phone);
  
  IF v_phone IS NOT NULL AND v_phone != '' THEN
    SELECT id INTO v_customer_id
    FROM customers
    WHERE normalize_phone(phone) = v_phone
    ORDER BY created_at ASC
    LIMIT 1;
    
    IF FOUND THEN
      UPDATE customers
      SET 
        name = COALESCE(NEW.customer_name, name),
        email = COALESCE(NEW.customer_email, email),
        address = COALESCE(NEW.customer_address, address),
        city = COALESCE(NEW.city, city),
        phone = CASE WHEN phone IS NULL OR phone = '' THEN NEW.customer_phone ELSE phone END,
        phone_last_5_chr = RIGHT(v_phone, 5),
        updated_at = now()
      WHERE id = v_customer_id;
      
      NEW.customer_id := v_customer_id;
      RETURN NEW;
    END IF;
  END IF;
  
  IF NEW.customer_email IS NOT NULL AND NEW.customer_email != '' THEN
    SELECT id INTO v_customer_id
    FROM customers
    WHERE LOWER(TRIM(name)) = LOWER(TRIM(NEW.customer_name))
      AND LOWER(TRIM(email)) = LOWER(TRIM(NEW.customer_email))
    ORDER BY created_at ASC
    LIMIT 1;
    
    IF FOUND THEN
      UPDATE customers
      SET 
        phone = COALESCE(NEW.customer_phone, phone),
        phone_last_5_chr = CASE WHEN v_phone IS NOT NULL THEN RIGHT(v_phone, 5) ELSE phone_last_5_chr END,
        address = COALESCE(NEW.customer_address, address),
        city = COALESCE(NEW.city, city),
        updated_at = now()
      WHERE id = v_customer_id;
      
      NEW.customer_id := v_customer_id;
      RETURN NEW;
    END IF;
  END IF;
  
  INSERT INTO customers (
    name, phone, email, address, city, phone_last_5_chr, total_orders, return_count, is_suspicious
  ) VALUES (
    NEW.customer_name, NEW.customer_phone, NEW.customer_email, NEW.customer_address, NEW.city,
    CASE WHEN v_phone IS NOT NULL THEN RIGHT(v_phone, 5) ELSE NULL END, 0, 0, false
  )
  RETURNING id INTO v_customer_id;
  
  NEW.customer_id := v_customer_id;
  RETURN NEW;
END;
$function$;