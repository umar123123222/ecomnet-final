-- Create storage bucket for transfer variance proof images
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('transfer-variance-proofs', 'transfer-variance-proofs', true, 5242880)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload to the bucket
CREATE POLICY "Authenticated users can upload transfer variance proofs"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'transfer-variance-proofs');

-- Allow public read access
CREATE POLICY "Public can view transfer variance proofs"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'transfer-variance-proofs');

-- Allow authenticated users to delete their uploads
CREATE POLICY "Authenticated users can delete transfer variance proofs"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'transfer-variance-proofs');