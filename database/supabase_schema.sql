-- ============================================================
-- BHARAT BIZ-AGENT - Complete Supabase Schema
-- ============================================================
-- Run this in Supabase SQL Editor to set up the complete database
-- ============================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- 1. SHOP PROFILES
-- ============================================================
CREATE TABLE shop_profiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  owner_phone TEXT UNIQUE NOT NULL,
  shop_name TEXT NOT NULL,
  owner_name TEXT NOT NULL,
  address TEXT,
  upi_id TEXT, -- For payment QR generation
  gst_number TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 2. CUSTOMERS
-- ============================================================
CREATE TABLE customers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  shop_id UUID REFERENCES shop_profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  phone TEXT,
  total_udhaar DECIMAL(12,2) DEFAULT 0, -- Total credit balance
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(shop_id, phone)
);

-- ============================================================
-- 3. PRODUCTS (INVENTORY)
-- ============================================================
CREATE TABLE products (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  shop_id UUID REFERENCES shop_profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  name_hindi TEXT, -- Hindi name for better AI matching
  category TEXT,
  price DECIMAL(10,2) NOT NULL,
  stock INTEGER DEFAULT 0,
  unit TEXT DEFAULT 'pcs', -- kg, litre, pcs, packet
  low_stock_threshold INTEGER DEFAULT 5,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 4. ORDERS
-- ============================================================
CREATE TYPE order_status AS ENUM ('pending', 'confirmed', 'rejected', 'completed', 'cancelled');
CREATE TYPE payment_status AS ENUM ('pending', 'paid', 'failed', 'refunded');

CREATE TABLE orders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  shop_id UUID REFERENCES shop_profiles(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES customers(id),
  customer_name TEXT NOT NULL,
  customer_phone TEXT NOT NULL,
  status order_status DEFAULT 'pending',
  payment_status payment_status DEFAULT 'pending',
  total_amount DECIMAL(12,2) NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 5. ORDER ITEMS
-- ============================================================
CREATE TABLE order_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id),
  product_name TEXT NOT NULL,
  quantity INTEGER NOT NULL,
  unit TEXT DEFAULT 'pcs',
  price DECIMAL(10,2) NOT NULL,
  subtotal DECIMAL(12,2) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 6. PAYMENTS
-- ============================================================
CREATE TABLE payments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  shop_id UUID REFERENCES shop_profiles(id) ON DELETE CASCADE,
  order_id UUID REFERENCES orders(id),
  customer_id UUID REFERENCES customers(id),
  amount DECIMAL(12,2) NOT NULL,
  payment_method TEXT DEFAULT 'upi', -- upi, cash, card
  screenshot_url TEXT, -- For UPI payment verification
  status payment_status DEFAULT 'pending',
  verified_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 7. UDHAAR LEDGER (Credit Tracking)
-- ============================================================
CREATE TYPE ledger_type AS ENUM ('credit', 'payment');

CREATE TABLE udhaar_ledger (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  shop_id UUID REFERENCES shop_profiles(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
  order_id UUID REFERENCES orders(id),
  type ledger_type NOT NULL,
  amount DECIMAL(12,2) NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 8. SALES (Daily Summary)
-- ============================================================
CREATE TABLE sales (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  shop_id UUID REFERENCES shop_profiles(id) ON DELETE CASCADE,
  sale_date DATE NOT NULL,
  total_orders INTEGER DEFAULT 0,
  total_amount DECIMAL(12,2) DEFAULT 0,
  cash_amount DECIMAL(12,2) DEFAULT 0,
  upi_amount DECIMAL(12,2) DEFAULT 0,
  credit_amount DECIMAL(12,2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(shop_id, sale_date)
);

-- ============================================================
-- 9. NOTIFICATIONS (For Mobile App)
-- ============================================================
CREATE TYPE notification_type AS ENUM ('new_order', 'payment_received', 'low_stock', 'payment_reminder', 'system');

CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  shop_id UUID REFERENCES shop_profiles(id) ON DELETE CASCADE,
  type notification_type NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  data JSONB,
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 10. PUSH TOKENS (For Expo Notifications)
-- ============================================================
CREATE TABLE push_tokens (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  shop_id UUID REFERENCES shop_profiles(id) ON DELETE CASCADE,
  expo_push_token TEXT NOT NULL UNIQUE,
  device_info JSONB,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- INDEXES
-- ============================================================
CREATE INDEX idx_customers_shop ON customers(shop_id);
CREATE INDEX idx_customers_phone ON customers(phone);
CREATE INDEX idx_products_shop ON products(shop_id);
CREATE INDEX idx_products_name ON products(name);
CREATE INDEX idx_orders_shop ON orders(shop_id);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_customer_phone ON orders(customer_phone);
CREATE INDEX idx_orders_created ON orders(created_at DESC);
CREATE INDEX idx_order_items_order ON order_items(order_id);
CREATE INDEX idx_payments_shop ON payments(shop_id);
CREATE INDEX idx_payments_order ON payments(order_id);
CREATE INDEX idx_udhaar_customer ON udhaar_ledger(customer_id);
CREATE INDEX idx_notifications_shop ON notifications(shop_id);
CREATE INDEX idx_notifications_unread ON notifications(shop_id, is_read) WHERE NOT is_read;

-- ============================================================
-- FUNCTIONS & TRIGGERS
-- ============================================================

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_shop_profiles_updated_at
  BEFORE UPDATE ON shop_profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_customers_updated_at
  BEFORE UPDATE ON customers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_products_updated_at
  BEFORE UPDATE ON products
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_orders_updated_at
  BEFORE UPDATE ON orders
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Auto-update customer's total_udhaar when ledger entry is added
CREATE OR REPLACE FUNCTION update_customer_udhaar()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.type = 'credit' THEN
    UPDATE customers SET total_udhaar = total_udhaar + NEW.amount WHERE id = NEW.customer_id;
  ELSIF NEW.type = 'payment' THEN
    UPDATE customers SET total_udhaar = total_udhaar - NEW.amount WHERE id = NEW.customer_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_udhaar_on_ledger_insert
  AFTER INSERT ON udhaar_ledger
  FOR EACH ROW EXECUTE FUNCTION update_customer_udhaar();

-- Auto-calculate order item subtotal
CREATE OR REPLACE FUNCTION calculate_subtotal()
RETURNS TRIGGER AS $$
BEGIN
  NEW.subtotal = NEW.quantity * NEW.price;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER calculate_order_item_subtotal
  BEFORE INSERT OR UPDATE ON order_items
  FOR EACH ROW EXECUTE FUNCTION calculate_subtotal();

-- ============================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================
ALTER TABLE shop_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE udhaar_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE push_tokens ENABLE ROW LEVEL SECURITY;

-- Create policies (allow all for now, tighten in production)
CREATE POLICY "Allow all" ON shop_profiles FOR ALL USING (true);
CREATE POLICY "Allow all" ON customers FOR ALL USING (true);
CREATE POLICY "Allow all" ON products FOR ALL USING (true);
CREATE POLICY "Allow all" ON orders FOR ALL USING (true);
CREATE POLICY "Allow all" ON order_items FOR ALL USING (true);
CREATE POLICY "Allow all" ON payments FOR ALL USING (true);
CREATE POLICY "Allow all" ON udhaar_ledger FOR ALL USING (true);
CREATE POLICY "Allow all" ON sales FOR ALL USING (true);
CREATE POLICY "Allow all" ON notifications FOR ALL USING (true);
CREATE POLICY "Allow all" ON push_tokens FOR ALL USING (true);

-- ============================================================
-- REALTIME (Enable for live updates in mobile app)
-- ============================================================
ALTER PUBLICATION supabase_realtime ADD TABLE orders;
ALTER PUBLICATION supabase_realtime ADD TABLE notifications;
ALTER PUBLICATION supabase_realtime ADD TABLE products;

-- ============================================================
-- SAMPLE DATA (One shop for testing)
-- ============================================================
INSERT INTO shop_profiles (id, owner_phone, shop_name, owner_name, upi_id) VALUES
  ('c1b7bdf8-5661-4bdb-bfb3-ad11fff0adc4', '919395386870', 'Sharma Kirana Store', 'Rahul Sharma', 'rahul@upi');

-- Sample products
INSERT INTO products (shop_id, name, name_hindi, category, price, stock, unit, low_stock_threshold) VALUES
  ('c1b7bdf8-5661-4bdb-bfb3-ad11fff0adc4', 'Rice 5kg', 'चावल 5kg', 'Grains', 250, 50, 'bag', 10),
  ('c1b7bdf8-5661-4bdb-bfb3-ad11fff0adc4', 'Rice 1kg', 'चावल 1kg', 'Grains', 55, 100, 'bag', 20),
  ('c1b7bdf8-5661-4bdb-bfb3-ad11fff0adc4', 'Toor Dal 1kg', 'तूर दाल 1kg', 'Pulses', 140, 40, 'bag', 10),
  ('c1b7bdf8-5661-4bdb-bfb3-ad11fff0adc4', 'Moong Dal 1kg', 'मूंग दाल 1kg', 'Pulses', 120, 35, 'bag', 10),
  ('c1b7bdf8-5661-4bdb-bfb3-ad11fff0adc4', 'Sugar 1kg', 'चीनी 1kg', 'Essentials', 45, 80, 'kg', 15),
  ('c1b7bdf8-5661-4bdb-bfb3-ad11fff0adc4', 'Cooking Oil 1L', 'खाना पकाने का तेल 1L', 'Oils', 130, 25, 'bottle', 5),
  ('c1b7bdf8-5661-4bdb-bfb3-ad11fff0adc4', 'Atta 5kg', 'आटा 5kg', 'Grains', 220, 30, 'bag', 8),
  ('c1b7bdf8-5661-4bdb-bfb3-ad11fff0adc4', 'Salt 1kg', 'नमक 1kg', 'Essentials', 25, 60, 'packet', 15),
  ('c1b7bdf8-5661-4bdb-bfb3-ad11fff0adc4', 'Tea 250g', 'चाय 250g', 'Beverages', 90, 45, 'packet', 10),
  ('c1b7bdf8-5661-4bdb-bfb3-ad11fff0adc4', 'Milk 500ml', 'दूध 500ml', 'Dairy', 30, 20, 'packet', 5);

-- Sample customers
INSERT INTO customers (shop_id, name, phone, total_udhaar) VALUES
  ('c1b7bdf8-5661-4bdb-bfb3-ad11fff0adc4', 'Amit Kumar', '919876543210', 500),
  ('c1b7bdf8-5661-4bdb-bfb3-ad11fff0adc4', 'Priya Singh', '919876543211', 0),
  ('c1b7bdf8-5661-4bdb-bfb3-ad11fff0adc4', 'Rajesh Verma', '919876543212', 1200);

-- ============================================================
-- DONE! Your database is ready.
-- ============================================================
