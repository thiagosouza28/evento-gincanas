-- Create storage bucket for team images
INSERT INTO storage.buckets (id, name, public)
VALUES ('equipes-imagens', 'equipes-imagens', true)
ON CONFLICT (id) DO NOTHING;

-- Policy to allow anyone to view team images (public bucket)
CREATE POLICY "Team images are publicly accessible"
ON storage.objects
FOR SELECT
USING (bucket_id = 'equipes-imagens');

-- Policy to allow anyone to upload team images
CREATE POLICY "Anyone can upload team images"
ON storage.objects
FOR INSERT
WITH CHECK (bucket_id = 'equipes-imagens');

-- Policy to allow anyone to update team images
CREATE POLICY "Anyone can update team images"
ON storage.objects
FOR UPDATE
USING (bucket_id = 'equipes-imagens');

-- Policy to allow anyone to delete team images
CREATE POLICY "Anyone can delete team images"
ON storage.objects
FOR DELETE
USING (bucket_id = 'equipes-imagens');