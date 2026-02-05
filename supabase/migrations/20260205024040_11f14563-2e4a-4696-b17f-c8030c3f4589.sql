-- Create storage bucket for character images
INSERT INTO storage.buckets (id, name, public)
VALUES ('character-images', 'character-images', true)
ON CONFLICT (id) DO NOTHING;

-- Allow public read access to character images
CREATE POLICY "Public read access for character images"
ON storage.objects
FOR SELECT
USING (bucket_id = 'character-images');

-- Allow authenticated users to upload character images
CREATE POLICY "Allow uploads to character images"
ON storage.objects
FOR INSERT
WITH CHECK (bucket_id = 'character-images');

-- Allow authenticated users to update their character images
CREATE POLICY "Allow updates to character images"
ON storage.objects
FOR UPDATE
USING (bucket_id = 'character-images');

-- Allow authenticated users to delete character images
CREATE POLICY "Allow deletes from character images"
ON storage.objects
FOR DELETE
USING (bucket_id = 'character-images');