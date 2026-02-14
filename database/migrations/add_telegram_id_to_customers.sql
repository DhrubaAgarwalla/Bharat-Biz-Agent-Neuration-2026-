-- ============================================================
-- Migration: Add Telegram ID and Address to Customers Table
-- ============================================================
-- Run this in Supabase SQL Editor
-- ============================================================

-- Add telegram_id column for Telegram customer identification
ALTER TABLE customers ADD COLUMN IF NOT EXISTS telegram_id TEXT;

-- Add address column for delivery information
ALTER TABLE customers ADD COLUMN IF NOT EXISTS address TEXT;

-- Create unique index for telegram_id per shop
CREATE UNIQUE INDEX IF NOT EXISTS idx_customers_telegram_shop 
ON customers(shop_id, telegram_id) 
WHERE telegram_id IS NOT NULL;

-- ============================================================
-- Enable pg_net extension for HTTP calls (if not already enabled)
-- Note: This may already be enabled in your Supabase project
-- ============================================================
-- CREATE EXTENSION IF NOT EXISTS pg_net;

-- ============================================================
-- DONE! Now configure Database Webhook in Supabase Dashboard:
-- 1. Go to Database → Webhooks
-- 2. Create new webhook:
--    - Name: send-push-notification
--    - Table: notifications
--    - Events: INSERT
--    - Type: Supabase Edge Function
--    - Function: send-push-notification
-- ============================================================
