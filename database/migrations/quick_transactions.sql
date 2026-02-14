-- ============================================================
-- QUICK TRANSACTIONS + STOCK UPDATE MIGRATION
-- Run this in Supabase SQL Editor
-- ============================================================

-- Quick transactions table for anonymous sales/udhaar
CREATE TABLE IF NOT EXISTS quick_transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  shop_id UUID REFERENCES shop_profiles(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('sale', 'udhaar')),
  amount DECIMAL(12,2) NOT NULL,
  customer_name TEXT, -- Optional for sales, required for udhaar (enforced in app)
  item_name TEXT,
  payment_method TEXT DEFAULT 'cash',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for quick lookups
CREATE INDEX IF NOT EXISTS idx_quick_transactions_shop ON quick_transactions(shop_id);
CREATE INDEX IF NOT EXISTS idx_quick_transactions_type ON quick_transactions(type);
CREATE INDEX IF NOT EXISTS idx_quick_transactions_date ON quick_transactions(created_at DESC);

-- Enable RLS
ALTER TABLE quick_transactions ENABLE ROW LEVEL SECURITY;

-- Allow all operations (tighten in production)
CREATE POLICY "Allow all" ON quick_transactions FOR ALL USING (true);
