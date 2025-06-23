-- Storage policies for photos bucket

-- Create the photos bucket (if it doesn't exist)
INSERT INTO storage.buckets (id, name, public)
VALUES ('xtreme-photos', 'xtreme-photos', true)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload photos
CREATE POLICY "Allow authenticated users to upload photos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'xtreme-photos');

-- Allow everyone to view public photos
CREATE POLICY "Allow public read access to photos"
ON storage.objects FOR SELECT
USING (bucket_id = 'xtreme-photos');
