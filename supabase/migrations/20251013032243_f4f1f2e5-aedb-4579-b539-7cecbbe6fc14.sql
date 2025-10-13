-- Add comments column for structured user comments
ALTER TABLE orders ADD COLUMN IF NOT EXISTS comments JSONB DEFAULT '[]'::jsonb;

-- Add index for better performance
CREATE INDEX IF NOT EXISTS idx_orders_comments ON orders USING gin (comments);

-- Add comment
COMMENT ON COLUMN orders.comments IS 'Structured user comments with timestamps, separate from order creation notes';