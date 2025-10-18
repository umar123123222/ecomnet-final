-- Fix security warnings for POS functions by setting search_path

DROP FUNCTION IF EXISTS generate_session_number();
CREATE OR REPLACE FUNCTION generate_session_number()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_number TEXT;
BEGIN
  SELECT 'SES-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' || LPAD(COALESCE(MAX(SUBSTRING(session_number FROM 14)::INTEGER), 0) + 1, 4, '0')
  INTO new_number
  FROM pos_sessions
  WHERE session_number LIKE 'SES-' || TO_CHAR(NOW(), 'YYYYMMDD') || '%';
  
  RETURN new_number;
END;
$$;

DROP FUNCTION IF EXISTS generate_sale_number();
CREATE OR REPLACE FUNCTION generate_sale_number()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_number TEXT;
BEGIN
  SELECT 'SALE-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' || LPAD(COALESCE(MAX(SUBSTRING(sale_number FROM 15)::INTEGER), 0) + 1, 6, '0')
  INTO new_number
  FROM pos_sales
  WHERE sale_number LIKE 'SALE-' || TO_CHAR(NOW(), 'YYYYMMDD') || '%';
  
  RETURN new_number;
END;
$$;

DROP FUNCTION IF EXISTS generate_receipt_number();
CREATE OR REPLACE FUNCTION generate_receipt_number()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_number TEXT;
BEGIN
  SELECT 'RCP-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' || LPAD(COALESCE(MAX(SUBSTRING(receipt_number FROM 14)::INTEGER), 0) + 1, 6, '0')
  INTO new_number
  FROM pos_receipts
  WHERE receipt_number LIKE 'RCP-' || TO_CHAR(NOW(), 'YYYYMMDD') || '%';
  
  RETURN new_number;
END;
$$;