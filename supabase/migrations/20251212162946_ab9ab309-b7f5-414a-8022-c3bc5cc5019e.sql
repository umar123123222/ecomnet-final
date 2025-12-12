-- Create storage bucket for GRN damage proof images
INSERT INTO storage.buckets (id, name, public)
VALUES ('grn-damage-proofs', 'grn-damage-proofs', true)
ON CONFLICT (id) DO NOTHING;

-- RLS policies for grn-damage-proofs bucket
CREATE POLICY "Authenticated users can upload damage proofs"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'grn-damage-proofs');

CREATE POLICY "Anyone can view damage proofs"
ON storage.objects FOR SELECT
USING (bucket_id = 'grn-damage-proofs');

CREATE POLICY "Authenticated users can delete damage proofs"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'grn-damage-proofs');