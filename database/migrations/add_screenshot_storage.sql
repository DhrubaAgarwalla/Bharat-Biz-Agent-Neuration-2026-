    -- ============================================================
    -- Add screenshot_url column to order_ongoing
    -- ============================================================

    -- Add the column (run this if table already exists)
    ALTER TABLE order_ongoing ADD COLUMN IF NOT EXISTS screenshot_url TEXT;

    -- ============================================================
    -- Create Supabase Storage bucket for payment screenshots
    -- ============================================================

    -- Create a public bucket for screenshots
    INSERT INTO storage.buckets (id, name, public) 
    VALUES ('payment-screenshots', 'payment-screenshots', true)
    ON CONFLICT (id) DO NOTHING;

    -- Allow public read access
    CREATE POLICY "Public Access" ON storage.objects
    FOR SELECT USING (bucket_id = 'payment-screenshots');

    -- Allow anon inserts
    CREATE POLICY "Allow Uploads" ON storage.objects
    FOR INSERT WITH CHECK (bucket_id = 'payment-screenshots');
