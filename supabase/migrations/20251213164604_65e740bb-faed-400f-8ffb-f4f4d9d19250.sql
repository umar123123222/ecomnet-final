-- Delete all GRN items first (child table)
DELETE FROM grn_items;

-- Delete all GRNs
DELETE FROM goods_received_notes;

-- Reset PO statuses back to sent for ones that had GRNs
UPDATE purchase_orders 
SET status = 'sent', received_at = NULL 
WHERE id IN (
  'c76adc21-6b45-4def-a22e-6877ede75efa',
  'c29bb116-6b3b-4f5e-bdea-87c74098af8a',
  'a6b2522c-a0a1-4bf4-8d4b-cf52b62b0701',
  'e2551f17-2121-44c9-a557-2da70d67bbda'
);