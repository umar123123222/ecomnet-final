-- Create function to normalize phone numbers (strip all non-digits)
CREATE OR REPLACE FUNCTION public.normalize_phone(p_phone text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  IF p_phone IS NULL THEN
    RETURN NULL;
  END IF;
  RETURN regexp_replace(p_phone, '[^0-9]', '', 'g');
END;
$$;

-- Create function to ensure customer exists and link to order
CREATE OR REPLACE FUNCTION public.ensure_customer_and_link()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_phone text;
  v_customer_id uuid;
BEGIN
  -- Normalize the phone number
  v_phone := normalize_phone(NEW.customer_phone);
  
  -- If phone is empty, return without linking
  IF v_phone IS NULL OR v_phone = '' THEN
    RETURN NEW;
  END IF;
  
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
      phone_last_5_chr = RIGHT(v_phone, 5),
      updated_at = now()
    WHERE id = v_customer_id;
  ELSE
    -- Create new customer
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
      v_phone,
      NEW.customer_email,
      NEW.customer_address,
      NEW.city,
      RIGHT(v_phone, 5),
      0,
      0,
      false
    )
    RETURNING id INTO v_customer_id;
  END IF;
  
  -- Set the customer_id on the order
  NEW.customer_id := v_customer_id;
  
  RETURN NEW;
END;
$$;

-- Create trigger to run before inserting orders
CREATE TRIGGER ensure_customer_on_order
  BEFORE INSERT ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.ensure_customer_and_link();

-- Backfill existing orders with missing customer_id
UPDATE public.orders o
SET customer_id = c.id
FROM public.customers c
WHERE o.customer_id IS NULL
  AND public.normalize_phone(o.customer_phone) = public.normalize_phone(c.phone);

-- Enable realtime for customers table
ALTER TABLE public.customers REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.customers;