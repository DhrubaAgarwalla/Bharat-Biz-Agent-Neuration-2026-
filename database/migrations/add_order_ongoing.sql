-- ============================================================
-- Add order_ongoing table for tracking order lifecycle
-- ============================================================

CREATE TABLE order_ongoing (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id UUID REFERENCES orders(id),            -- NULL until payment verified & order created
  customer_telegram_id TEXT NOT NULL,              -- Telegram chat ID
  customer_name TEXT,
  status TEXT NOT NULL DEFAULT 'payment_pending',  -- payment_pending → payment_verified/payment_warning → confirmed → completed
  items_json JSONB NOT NULL,                       -- [{name, qty, unit, price}]
  total_amount DECIMAL(12,2) NOT NULL,
  payment_data JSONB,                              -- {utr, amount_paid, sender, app, status}
  warning_message TEXT,                            -- If payment amount mismatch
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_order_ongoing_telegram ON order_ongoing(customer_telegram_id);
CREATE INDEX idx_order_ongoing_status ON order_ongoing(status);
CREATE INDEX idx_order_ongoing_order ON order_ongoing(order_id);

-- RLS
ALTER TABLE order_ongoing ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all" ON order_ongoing FOR ALL USING (true);

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE order_ongoing;

-- Auto-update updated_at
CREATE TRIGGER update_order_ongoing_updated_at
  BEFORE UPDATE ON order_ongoing
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
