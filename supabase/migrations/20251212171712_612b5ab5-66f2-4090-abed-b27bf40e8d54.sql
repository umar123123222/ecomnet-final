-- Clean up duplicate GRNs: Keep only the latest GRN for each PO
-- First, identify and delete older duplicate grn_items
DELETE FROM grn_items
WHERE grn_id IN (
  SELECT id FROM goods_received_notes grn
  WHERE EXISTS (
    SELECT 1 FROM goods_received_notes newer
    WHERE newer.po_id = grn.po_id
    AND newer.created_at > grn.created_at
  )
);

-- Then delete the older duplicate GRNs themselves
DELETE FROM goods_received_notes grn
WHERE EXISTS (
  SELECT 1 FROM goods_received_notes newer
  WHERE newer.po_id = grn.po_id
  AND newer.created_at > grn.created_at
);