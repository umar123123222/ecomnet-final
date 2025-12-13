-- Fix Dec 14 movement: Correct created_by from Shoaib to Muhammad Umar
UPDATE packaging_movements 
SET created_by = 'ff812d62-9e9e-4ba6-a462-45ecb6fb4b16'  -- Muhammad Umar
WHERE id = '16974981-1479-4947-a74a-53391f56cf53';