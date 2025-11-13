-- Add html_images column to courier_awbs table for storing individual PDF pages
-- This enables HTML-based printing with 3 AWBs per A4 page layout

ALTER TABLE courier_awbs 
ADD COLUMN IF NOT EXISTS html_images TEXT;

COMMENT ON COLUMN courier_awbs.html_images IS 'JSON array of base64-encoded individual PDF pages for HTML rendering';