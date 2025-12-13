-- Backfill historical central packaging adjustments into unified packaging_movements
INSERT INTO public.packaging_movements (
  id,
  packaging_item_id,
  movement_type,
  quantity,
  notes,
  created_at,
  created_by,
  reference_id
)
SELECT
  psm.id,
  psm.packaging_item_id,
  psm.movement_type,
  psm.quantity,
  psm.notes,
  COALESCE(psm.created_at, now()),
  psm.performed_by,
  NULL::uuid
FROM public.packaging_stock_movements psm
WHERE NOT EXISTS (
  SELECT 1 FROM public.packaging_movements pm WHERE pm.id = psm.id
);

-- Optional: you may later decide to stop using packaging_stock_movements,
-- but for now we keep it as an additional audit table.