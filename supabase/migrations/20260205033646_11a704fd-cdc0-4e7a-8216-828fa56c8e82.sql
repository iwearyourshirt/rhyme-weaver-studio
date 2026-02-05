-- Create scene-images storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('scene-images', 'scene-images', true);

-- Allow public read access to scene images
CREATE POLICY "Public can view scene images"
ON storage.objects FOR SELECT
USING (bucket_id = 'scene-images');

-- Allow authenticated users to upload scene images
CREATE POLICY "Authenticated users can upload scene images"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'scene-images');

-- Allow authenticated users to update scene images
CREATE POLICY "Authenticated users can update scene images"
ON storage.objects FOR UPDATE
USING (bucket_id = 'scene-images');

-- Allow authenticated users to delete scene images
CREATE POLICY "Authenticated users can delete scene images"
ON storage.objects FOR DELETE
USING (bucket_id = 'scene-images');