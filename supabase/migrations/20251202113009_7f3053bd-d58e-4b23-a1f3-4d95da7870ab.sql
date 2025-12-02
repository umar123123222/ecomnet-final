
-- Function to merge duplicate customers
CREATE OR REPLACE FUNCTION merge_duplicate_customers()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  customer_record RECORD;
  primary_customer_id UUID;
  duplicate_ids UUID[];
BEGIN
  -- Find duplicates by normalized phone
  FOR customer_record IN
    SELECT 
      normalize_phone(phone) as normalized_phone,
      ARRAY_AGG(id ORDER BY created_at ASC) as customer_ids,
      COUNT(*) as duplicate_count
    FROM customers
    WHERE phone IS NOT NULL AND phone != ''
    GROUP BY normalize_phone(phone)
    HAVING COUNT(*) > 1
  LOOP
    -- First customer (oldest) becomes primary
    primary_customer_id := customer_record.customer_ids[1];
    duplicate_ids := customer_record.customer_ids[2:];
    
    -- Update orders to point to primary customer
    UPDATE orders
    SET customer_id = primary_customer_id
    WHERE customer_id = ANY(duplicate_ids);
    
    -- Update order confirmations
    UPDATE order_confirmations
    SET customer_id = primary_customer_id
    WHERE customer_id = ANY(duplicate_ids);
    
    -- Update conversations
    UPDATE conversations
    SET customer_id = primary_customer_id
    WHERE customer_id = ANY(duplicate_ids);
    
    -- Merge customer data (take non-null values from duplicates)
    UPDATE customers
    SET
      email = COALESCE(customers.email, (
        SELECT email FROM customers WHERE id = ANY(duplicate_ids) AND email IS NOT NULL LIMIT 1
      )),
      address = COALESCE(customers.address, (
        SELECT address FROM customers WHERE id = ANY(duplicate_ids) AND address IS NOT NULL LIMIT 1
      )),
      city = COALESCE(customers.city, (
        SELECT city FROM customers WHERE id = ANY(duplicate_ids) AND city IS NOT NULL LIMIT 1
      )),
      total_orders = (
        SELECT SUM(total_orders) FROM customers WHERE id = primary_customer_id OR id = ANY(duplicate_ids)
      ),
      delivered_count = (
        SELECT SUM(COALESCE(delivered_count, 0)) FROM customers WHERE id = primary_customer_id OR id = ANY(duplicate_ids)
      ),
      return_count = (
        SELECT SUM(COALESCE(return_count, 0)) FROM customers WHERE id = primary_customer_id OR id = ANY(duplicate_ids)
      ),
      updated_at = NOW()
    WHERE id = primary_customer_id;
    
    -- Delete duplicate customers
    DELETE FROM customers WHERE id = ANY(duplicate_ids);
    
    RAISE NOTICE 'Merged % duplicate customers for phone %', array_length(duplicate_ids, 1), customer_record.normalized_phone;
  END LOOP;
  
  -- Also merge customers with same name and no phone
  FOR customer_record IN
    SELECT 
      name,
      ARRAY_AGG(id ORDER BY created_at ASC) as customer_ids,
      COUNT(*) as duplicate_count
    FROM customers
    WHERE (phone IS NULL OR phone = '') 
      AND name IS NOT NULL 
      AND name != ''
    GROUP BY name
    HAVING COUNT(*) > 1
  LOOP
    primary_customer_id := customer_record.customer_ids[1];
    duplicate_ids := customer_record.customer_ids[2:];
    
    -- Update related records
    UPDATE orders SET customer_id = primary_customer_id WHERE customer_id = ANY(duplicate_ids);
    UPDATE order_confirmations SET customer_id = primary_customer_id WHERE customer_id = ANY(duplicate_ids);
    UPDATE conversations SET customer_id = primary_customer_id WHERE customer_id = ANY(duplicate_ids);
    
    -- Merge data
    UPDATE customers
    SET
      phone = COALESCE(customers.phone, (
        SELECT phone FROM customers WHERE id = ANY(duplicate_ids) AND phone IS NOT NULL AND phone != '' LIMIT 1
      )),
      email = COALESCE(customers.email, (
        SELECT email FROM customers WHERE id = ANY(duplicate_ids) AND email IS NOT NULL LIMIT 1
      )),
      address = COALESCE(customers.address, (
        SELECT address FROM customers WHERE id = ANY(duplicate_ids) AND address IS NOT NULL LIMIT 1
      )),
      city = COALESCE(customers.city, (
        SELECT city FROM customers WHERE id = ANY(duplicate_ids) AND city IS NOT NULL LIMIT 1
      )),
      total_orders = (
        SELECT SUM(total_orders) FROM customers WHERE id = primary_customer_id OR id = ANY(duplicate_ids)
      ),
      delivered_count = (
        SELECT SUM(COALESCE(delivered_count, 0)) FROM customers WHERE id = primary_customer_id OR id = ANY(duplicate_ids)
      ),
      return_count = (
        SELECT SUM(COALESCE(return_count, 0)) FROM customers WHERE id = primary_customer_id OR id = ANY(duplicate_ids)
      ),
      updated_at = NOW()
    WHERE id = primary_customer_id;
    
    DELETE FROM customers WHERE id = ANY(duplicate_ids);
    
    RAISE NOTICE 'Merged % duplicate customers for name %', array_length(duplicate_ids, 1), customer_record.name;
  END LOOP;
END;
$$;

-- Execute the merge function to clean up existing duplicates
SELECT merge_duplicate_customers();

-- Update ensure_customer_and_link to better handle duplicates
CREATE OR REPLACE FUNCTION public.ensure_customer_and_link()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_phone text;
  v_customer_id uuid;
  v_existing_count integer;
BEGIN
  -- Normalize the phone number
  v_phone := normalize_phone(NEW.customer_phone);
  
  -- If phone is not empty, find by phone
  IF v_phone IS NOT NULL AND v_phone != '' THEN
    -- Try to find existing customer by normalized phone
    SELECT id INTO v_customer_id
    FROM customers
    WHERE normalize_phone(phone) = v_phone
    ORDER BY created_at ASC
    LIMIT 1;
    
    IF FOUND THEN
      -- Update existing customer with new info (non-destructively)
      UPDATE customers
      SET 
        name = COALESCE(NEW.customer_name, name),
        email = COALESCE(NEW.customer_email, email),
        address = COALESCE(NEW.customer_address, address),
        city = COALESCE(NEW.city, city),
        phone = CASE 
          WHEN phone IS NULL OR phone = '' THEN NEW.customer_phone
          ELSE phone
        END,
        phone_last_5_chr = RIGHT(v_phone, 5),
        updated_at = now()
      WHERE id = v_customer_id;
      
      NEW.customer_id := v_customer_id;
      RETURN NEW;
    END IF;
  END IF;
  
  -- If no phone or not found by phone, try to find by name and email
  IF NEW.customer_email IS NOT NULL AND NEW.customer_email != '' THEN
    SELECT id INTO v_customer_id
    FROM customers
    WHERE LOWER(TRIM(name)) = LOWER(TRIM(NEW.customer_name))
      AND LOWER(TRIM(email)) = LOWER(TRIM(NEW.customer_email))
    ORDER BY created_at ASC
    LIMIT 1;
    
    IF FOUND THEN
      -- Update with phone if we have it
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
  
  -- Create new customer only if no match found
  INSERT INTO customers (
    name,
    phone,
    email,
    address,
    city,
    phone_last_5_chr,
    total_orders,
    return_count,
    is_suspicious
  ) VALUES (
    NEW.customer_name,
    NEW.customer_phone,
    NEW.customer_email,
    NEW.customer_address,
    NEW.city,
    CASE WHEN v_phone IS NOT NULL THEN RIGHT(v_phone, 5) ELSE NULL END,
    0,
    0,
    false
  )
  RETURNING id INTO v_customer_id;
  
  NEW.customer_id := v_customer_id;
  RETURN NEW;
END;
$$;
