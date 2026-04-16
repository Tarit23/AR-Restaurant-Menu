-- =====================================================
-- AR MENU PLATFORM — SUPABASE DATABASE SETUP
-- Run this entire script in the Supabase SQL Editor
-- =====================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================
-- 1. RESTAURANTS
-- =====================================================
CREATE TABLE IF NOT EXISTS restaurants (
  id                        UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name                      TEXT NOT NULL,
  owner_email               TEXT NOT NULL,
  plan                      TEXT CHECK (plan IN ('basic', 'pro', 'enterprise')),
  subscription_status       TEXT DEFAULT 'pending' CHECK (subscription_status IN ('active', 'expired', 'pending', 'cancelled')),
  autopay_enabled           BOOLEAN DEFAULT FALSE,
  next_payment_date         TIMESTAMPTZ,
  razorpay_customer_id      TEXT,
  razorpay_subscription_id  TEXT,
  created_at                TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- 2. USERS
-- =====================================================
CREATE TABLE IF NOT EXISTS users (
  id              UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email           TEXT NOT NULL,
  role            TEXT NOT NULL DEFAULT 'restaurant' CHECK (role IN ('super_admin', 'restaurant')),
  restaurant_id   UUID REFERENCES restaurants(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- 3. MENU ITEMS
-- =====================================================
CREATE TABLE IF NOT EXISTS menu_items (
  id              UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  restaurant_id   UUID REFERENCES restaurants(id) ON DELETE CASCADE NOT NULL,
  name            TEXT NOT NULL,
  price           NUMERIC(10, 2) NOT NULL DEFAULT 0,
  image_url       TEXT,
  model_url       TEXT,
  is_available    BOOLEAN DEFAULT TRUE,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- 4. PAYMENT LOGS
-- =====================================================
CREATE TABLE IF NOT EXISTS payment_logs (
  id                    UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  restaurant_id         UUID REFERENCES restaurants(id) ON DELETE SET NULL,
  razorpay_payment_id   TEXT,
  razorpay_event        TEXT,
  amount                NUMERIC(10, 2),
  currency              TEXT DEFAULT 'INR',
  plan                  TEXT,
  status                TEXT CHECK (status IN ('success', 'failed', 'pending')),
  created_at            TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- INDEXES
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_menu_items_restaurant ON menu_items(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_users_restaurant       ON users(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_payment_logs_restaurant ON payment_logs(restaurant_id);

-- =====================================================
-- ROW LEVEL SECURITY (RLS)
-- =====================================================
ALTER TABLE restaurants  ENABLE ROW LEVEL SECURITY;
ALTER TABLE users        ENABLE ROW LEVEL SECURITY;
ALTER TABLE menu_items   ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_logs ENABLE ROW LEVEL SECURITY;

-- ── Restaurants policies ──

-- Super admin can do anything
CREATE POLICY "Super admin full access on restaurants"
  ON restaurants FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
        AND users.role = 'super_admin'
    )
  );

-- Restaurant users can read their own
CREATE POLICY "Restaurant users read own restaurant"
  ON restaurants FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
        AND users.restaurant_id = restaurants.id
    )
  );

-- Restaurant users can update own subscription fields
CREATE POLICY "Restaurant users update own subscription"
  ON restaurants FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
        AND users.restaurant_id = restaurants.id
    )
  );

-- Public can read restaurants (for menu page)
CREATE POLICY "Public read restaurants"
  ON restaurants FOR SELECT
  USING (true);

-- ── Users policies ──

-- Create a helper function to avoid recursive RLS
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM users
    WHERE id = auth.uid()
      AND role = 'super_admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE POLICY "Super admin full access on users"
  ON users FOR ALL
  USING (is_admin());

CREATE POLICY "Users read own profile"
  ON users FOR SELECT
  USING (id = auth.uid());

-- ── Menu Items policies ──

-- Super admin can do anything
CREATE POLICY "Super admin full access on menu_items"
  ON menu_items FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
        AND users.role = 'super_admin'
    )
  );

-- Restaurant users can manage their own menu
CREATE POLICY "Restaurant users manage own menu"
  ON menu_items FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
        AND users.restaurant_id = menu_items.restaurant_id
    )
  );

-- Public can read menu items
CREATE POLICY "Public read menu_items"
  ON menu_items FOR SELECT
  USING (true);

-- ── Payment Logs policies ──

CREATE POLICY "Super admin full access on payment_logs"
  ON payment_logs FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
        AND users.role = 'super_admin'
    )
  );

CREATE POLICY "Restaurant users read own payment logs"
  ON payment_logs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
        AND users.restaurant_id = payment_logs.restaurant_id
    )
  );

CREATE POLICY "Anyone can insert payment logs"
  ON payment_logs FOR INSERT
  WITH CHECK (true);

-- =====================================================
-- STORAGE BUCKETS
-- =====================================================
-- Run these in the Supabase Storage settings or via dashboard:
-- 1. Create bucket: "menu-images" (public: true)
-- 2. Create bucket: "menu-models" (public: true)

-- =====================================================
-- SEED: CREATE SUPER ADMIN USER
-- =====================================================
-- After running this SQL, go to Supabase Auth > Users and:
-- 1. Create a user with email: admin@armenu.app, password: <your-password>
-- 2. Get the user's UUID from the Auth dashboard
-- 3. Run the following with the actual UUID:

-- INSERT INTO users (id, email, role)
-- VALUES ('PUT-YOUR-AUTH-USER-UUID-HERE', 'admin@armenu.app', 'super_admin');

-- =====================================================
-- WEBHOOK SETUP (for Razorpay)
-- =====================================================
-- Create a Supabase Edge Function: "razorpay-webhook"
-- Set Razorpay webhook URL to:
-- https://YOUR_PROJECT_ID.supabase.co/functions/v1/razorpay-webhook
-- 
-- The function should:
-- 1. Verify the Razorpay signature
-- 2. On payment.captured -> subscription_status = 'active', update next_payment_date
-- 3. On subscription.charged -> update next_payment_date
-- 4. On payment.failed -> subscription_status = 'expired', autopay_enabled = false
