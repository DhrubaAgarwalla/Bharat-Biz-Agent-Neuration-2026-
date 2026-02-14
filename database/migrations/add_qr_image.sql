-- Add QR image URL column to shop_profiles
-- Run this in Supabase SQL Editor
ALTER TABLE shop_profiles ADD COLUMN IF NOT EXISTS qr_image_url TEXT;

-- Create storage bucket for shop assets (if not exists)
-- Go to Supabase Dashboard > Storage > Create bucket: "shop-assets" (public)
-- Allow anyone to upload to shop-assets bucket
CREATE POLICY "Allow public uploads" ON storage.objects
  FOR INSERT
  WITH CHECK (bucket_id = 'shop-assets');

-- Allow anyone to read from shop-assets bucket  
CREATE POLICY "Allow public reads" ON storage.objects
  FOR SELECT
  USING (bucket_id = 'shop-assets');

-- Allow anyone to update in shop-assets bucket
CREATE POLICY "Allow public updates" ON storage.objects
  FOR UPDATE
  USING (bucket_id = 'shop-assets');