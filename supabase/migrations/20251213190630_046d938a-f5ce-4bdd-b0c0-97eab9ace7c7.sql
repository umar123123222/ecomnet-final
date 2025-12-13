-- Update PO status to completed since GRN was already accepted
UPDATE purchase_orders 
SET status = 'completed', 
    received_at = NOW()
WHERE id = '862391df-69e7-46d4-8e6c-7da41aee3ffe' 
  AND status = 'in_transit';