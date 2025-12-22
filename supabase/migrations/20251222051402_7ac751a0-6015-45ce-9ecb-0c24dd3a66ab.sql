-- Fix all delivered orders to have the earliest delivered_at date from tracking history
-- This ensures orders delivered in November don't show December dates

WITH earliest_delivery_dates AS (
  SELECT 
    cth.order_id,
    MIN(
      COALESCE(
        -- Try to extract date from raw_response for PostEx
        CASE 
          WHEN cth.raw_response->'transactionStatusHistory' IS NOT NULL THEN
            (SELECT MIN((elem->>'updatedDate')::timestamp with time zone)
             FROM jsonb_array_elements(cth.raw_response->'transactionStatusHistory') AS elem
             WHERE LOWER(elem->>'transactionStatus') LIKE '%delivered%')
          ELSE NULL
        END,
        -- Fallback to checked_at
        cth.checked_at
      )
    ) as earliest_delivery
  FROM courier_tracking_history cth
  WHERE LOWER(cth.status) LIKE '%delivered%'
  GROUP BY cth.order_id
)
UPDATE orders o
SET delivered_at = edd.earliest_delivery
FROM earliest_delivery_dates edd
WHERE o.id = edd.order_id
  AND o.status = 'delivered'
  AND edd.earliest_delivery IS NOT NULL
  AND (o.delivered_at IS NULL OR edd.earliest_delivery < o.delivered_at);