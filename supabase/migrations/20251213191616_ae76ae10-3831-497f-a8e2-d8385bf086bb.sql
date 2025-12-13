-- Fix GRN-2025-3141: Add missing grn_items
INSERT INTO grn_items (
  grn_id, 
  po_item_id, 
  packaging_item_id, 
  quantity_expected, 
  quantity_received, 
  quantity_accepted, 
  unit_cost, 
  quality_status
)
SELECT 
  '8f75d0d3-aacd-44c1-b70e-75bc35fb1b28',
  '941630af-dd46-44d8-99d9-3e29b9fbffa4',
  'f3291e35-4271-436c-81c7-2e3eb0cb4d9a',
  12000,
  19983,
  19983,
  15.00,
  'passed'
WHERE NOT EXISTS (
  SELECT 1 FROM grn_items WHERE grn_id = '8f75d0d3-aacd-44c1-b70e-75bc35fb1b28'
);

-- Update packaging inventory
UPDATE packaging_items
SET current_stock = current_stock + 19983,
    updated_at = NOW()
WHERE id = 'f3291e35-4271-436c-81c7-2e3eb0cb4d9a';

-- Create packaging movement record with created_by
INSERT INTO packaging_movements (
  packaging_item_id,
  movement_type,
  quantity,
  reference_id,
  notes,
  created_by
)
VALUES (
  'f3291e35-4271-436c-81c7-2e3eb0cb4d9a',
  'purchase',
  19983,
  '8f75d0d3-aacd-44c1-b70e-75bc35fb1b28',
  'GRN GRN-2025-3141 - Resolved (accepted)',
  '9a129b88-ed81-427a-a672-4740c2abd9f1'
);

-- Update PO item received quantity
UPDATE purchase_order_items
SET quantity_received = 19983
WHERE id = '941630af-dd46-44d8-99d9-3e29b9fbffa4';