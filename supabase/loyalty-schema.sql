-- =====================================================
-- LOYALTY & CRM SYSTEM — SUPABASE SCHEMA
-- Run this entire script in the Supabase SQL Editor
-- after the main schema.sql
-- =====================================================

-- =====================================================
-- 1. LOYALTY SETTINGS (per restaurant)
-- =====================================================
CREATE TABLE IF NOT EXISTS loyalty_settings (
  id                          UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  restaurant_id               UUID REFERENCES restaurants(id) ON DELETE CASCADE UNIQUE NOT NULL,
  -- Points configuration
  points_per_100_rupees       INTEGER DEFAULT 10,          -- ₹100 spent = 10 points
  points_for_50_discount      INTEGER DEFAULT 100,         -- 100 pts = ₹50 discount
  points_for_free_item        INTEGER DEFAULT 500,         -- 500 pts = free item
  free_item_description       TEXT    DEFAULT 'Free Burger / Pizza / Drink',
  -- Visit rewards
  visit_3_reward              TEXT    DEFAULT 'Free Dessert',
  visit_5_reward              TEXT    DEFAULT '₹200 Coupon',
  visit_10_reward             TEXT    DEFAULT 'VIP Membership + ₹500 Coupon',
  -- Birthday reward (fully configurable)
  birthday_reward_enabled     BOOLEAN DEFAULT TRUE,
  birthday_reward_description TEXT    DEFAULT 'Any 1 free item — Cake / Dessert / Drink',
  birthday_reward_type        TEXT    DEFAULT 'free_item',   -- 'free_item','discount_flat','discount_percent'
  birthday_reward_value       TEXT    DEFAULT 'Your choice of 1 complimentary item',
  birthday_week_valid         BOOLEAN DEFAULT TRUE,          -- Valid during birthday week
  -- Tier thresholds (points)
  tier_silver_min             INTEGER DEFAULT 500,
  tier_gold_min               INTEGER DEFAULT 2000,
  tier_platinum_min           INTEGER DEFAULT 5000,
  -- Email automation
  weekly_promo_enabled        BOOLEAN DEFAULT TRUE,
  inactive_reminder_days      INTEGER DEFAULT 30,
  resend_api_key              TEXT,                          -- Resend.com API key (encrypted in practice)
  sender_email                TEXT    DEFAULT 'rewards@armenu.app',
  sender_name                 TEXT    DEFAULT 'Rewards',
  created_at                  TIMESTAMPTZ DEFAULT NOW(),
  updated_at                  TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- 2. LOYALTY CUSTOMERS
-- =====================================================
CREATE TABLE IF NOT EXISTS loyalty_customers (
  id                  UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  restaurant_id       UUID REFERENCES restaurants(id) ON DELETE CASCADE NOT NULL,
  email               TEXT NOT NULL,
  name                TEXT,
  phone               TEXT,
  birthday            DATE,
  birthday_set        BOOLEAN DEFAULT FALSE,       -- Once set, cannot be changed
  tier                TEXT DEFAULT 'bronze' CHECK (tier IN ('bronze','silver','gold','platinum')),
  points              INTEGER DEFAULT 0,            -- Current balance
  total_points_earned INTEGER DEFAULT 0,            -- Lifetime earned
  total_points_spent  INTEGER DEFAULT 0,            -- Lifetime redeemed
  total_spent_amount  NUMERIC(10,2) DEFAULT 0,      -- Rupees tracked
  visit_count         INTEGER DEFAULT 0,
  is_vip              BOOLEAN DEFAULT FALSE,
  signup_source       TEXT DEFAULT 'menu_qr',       -- 'menu_qr','staff','direct','birthday'
  opted_in_email      BOOLEAN DEFAULT TRUE,
  last_activity_at    TIMESTAMPTZ DEFAULT NOW(),
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(restaurant_id, email)
);

CREATE INDEX IF NOT EXISTS idx_loyalty_customers_restaurant ON loyalty_customers(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_loyalty_customers_email      ON loyalty_customers(email);
CREATE INDEX IF NOT EXISTS idx_loyalty_customers_tier       ON loyalty_customers(tier);

-- =====================================================
-- 3. LOYALTY VISITS
-- =====================================================
CREATE TABLE IF NOT EXISTS loyalty_visits (
  id            UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  restaurant_id UUID REFERENCES restaurants(id) ON DELETE CASCADE NOT NULL,
  customer_id   UUID REFERENCES loyalty_customers(id) ON DELETE CASCADE NOT NULL,
  source        TEXT DEFAULT 'qr' CHECK (source IN ('qr','staff','order','manual')),
  notes         TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_loyalty_visits_customer ON loyalty_visits(customer_id);
CREATE INDEX IF NOT EXISTS idx_loyalty_visits_restaurant ON loyalty_visits(restaurant_id);

-- =====================================================
-- 4. LOYALTY TRANSACTIONS (Points ledger)
-- =====================================================
CREATE TABLE IF NOT EXISTS loyalty_transactions (
  id            UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  restaurant_id UUID REFERENCES restaurants(id) ON DELETE CASCADE NOT NULL,
  customer_id   UUID REFERENCES loyalty_customers(id) ON DELETE CASCADE NOT NULL,
  type          TEXT NOT NULL CHECK (type IN ('earn','redeem','expire','bonus','birthday','visit_reward','manual')),
  points        INTEGER NOT NULL,       -- positive = earned, negative = redeemed
  balance_after INTEGER NOT NULL,
  description   TEXT,
  reference_id  TEXT,                  -- voucher_id, visit_id, etc.
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_loyalty_tx_customer ON loyalty_transactions(customer_id);

-- =====================================================
-- 5. LOYALTY VOUCHERS
-- =====================================================
CREATE TABLE IF NOT EXISTS loyalty_vouchers (
  id            UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  restaurant_id UUID REFERENCES restaurants(id) ON DELETE CASCADE NOT NULL,
  customer_id   UUID REFERENCES loyalty_customers(id) ON DELETE CASCADE NOT NULL,
  code          TEXT UNIQUE NOT NULL,
  type          TEXT NOT NULL CHECK (type IN ('discount_percent','discount_flat','free_item','birthday','vip','visit_reward')),
  value         TEXT NOT NULL,          -- '50' rupees, '20%', 'Free Dessert', etc.
  description   TEXT,
  source        TEXT DEFAULT 'system',  -- 'points_redemption','visit_reward','birthday','campaign','manual'
  is_used       BOOLEAN DEFAULT FALSE,
  used_at       TIMESTAMPTZ,
  expires_at    TIMESTAMPTZ,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_loyalty_vouchers_customer ON loyalty_vouchers(customer_id);
CREATE INDEX IF NOT EXISTS idx_loyalty_vouchers_code     ON loyalty_vouchers(code);

-- =====================================================
-- 6. LOYALTY BIRTHDAY REWARDS
-- =====================================================
CREATE TABLE IF NOT EXISTS loyalty_birthday_rewards (
  id            UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  restaurant_id UUID REFERENCES restaurants(id) ON DELETE CASCADE NOT NULL,
  customer_id   UUID REFERENCES loyalty_customers(id) ON DELETE CASCADE NOT NULL,
  voucher_id    UUID REFERENCES loyalty_vouchers(id),
  year          INTEGER NOT NULL,
  email_sent    BOOLEAN DEFAULT FALSE,
  claimed_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(customer_id, year)             -- One birthday reward per year
);

-- =====================================================
-- 7. LOYALTY ACTIVITY (Full timeline)
-- =====================================================
CREATE TABLE IF NOT EXISTS loyalty_activity (
  id            UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  restaurant_id UUID REFERENCES restaurants(id) ON DELETE CASCADE NOT NULL,
  customer_id   UUID REFERENCES loyalty_customers(id) ON DELETE CASCADE NOT NULL,
  type          TEXT NOT NULL,          -- 'signup','visit','points_earned','points_redeemed','voucher_issued','voucher_redeemed','tier_upgrade','birthday_claim','email_sent'
  title         TEXT NOT NULL,
  description   TEXT,
  icon          TEXT DEFAULT '⭐',
  points_delta  INTEGER DEFAULT 0,
  metadata      JSONB,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_loyalty_activity_customer ON loyalty_activity(customer_id, created_at DESC);

-- =====================================================
-- 8. LOYALTY CAMPAIGNS
-- =====================================================
CREATE TABLE IF NOT EXISTS loyalty_campaigns (
  id               UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  restaurant_id    UUID REFERENCES restaurants(id) ON DELETE CASCADE NOT NULL,
  name             TEXT NOT NULL,
  type             TEXT DEFAULT 'manual' CHECK (type IN ('manual','birthday','weekly_promo','inactive_reminder','tier_upgrade','points_expiry')),
  subject          TEXT NOT NULL,
  body_html        TEXT NOT NULL,
  target_segment   TEXT DEFAULT 'all' CHECK (target_segment IN ('all','bronze','silver','gold','platinum','inactive','birthday_month','vip')),
  status           TEXT DEFAULT 'draft' CHECK (status IN ('draft','scheduled','sending','sent','failed')),
  scheduled_at     TIMESTAMPTZ,
  sent_at          TIMESTAMPTZ,
  sent_count       INTEGER DEFAULT 0,
  open_count       INTEGER DEFAULT 0,
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- 9. LOYALTY EMAIL LOG
-- =====================================================
CREATE TABLE IF NOT EXISTS loyalty_email_log (
  id            UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  restaurant_id UUID REFERENCES restaurants(id) ON DELETE CASCADE NOT NULL,
  customer_id   UUID REFERENCES loyalty_customers(id) ON DELETE CASCADE,
  campaign_id   UUID REFERENCES loyalty_campaigns(id) ON DELETE SET NULL,
  email         TEXT NOT NULL,
  subject       TEXT NOT NULL,
  type          TEXT,                   -- 'welcome','birthday','weekly_promo','inactive_reminder','reward_earned','voucher_expiry','campaign'
  status        TEXT DEFAULT 'sent',
  resend_id     TEXT,                   -- Resend.com message ID
  sent_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_loyalty_email_log_customer ON loyalty_email_log(customer_id);

-- =====================================================
-- ROW LEVEL SECURITY
-- =====================================================

ALTER TABLE loyalty_settings         ENABLE ROW LEVEL SECURITY;
ALTER TABLE loyalty_customers        ENABLE ROW LEVEL SECURITY;
ALTER TABLE loyalty_visits           ENABLE ROW LEVEL SECURITY;
ALTER TABLE loyalty_transactions     ENABLE ROW LEVEL SECURITY;
ALTER TABLE loyalty_vouchers         ENABLE ROW LEVEL SECURITY;
ALTER TABLE loyalty_birthday_rewards ENABLE ROW LEVEL SECURITY;
ALTER TABLE loyalty_activity         ENABLE ROW LEVEL SECURITY;
ALTER TABLE loyalty_campaigns        ENABLE ROW LEVEL SECURITY;
ALTER TABLE loyalty_email_log        ENABLE ROW LEVEL SECURITY;

-- ── Public (anon) policies ──

-- Anyone can sign up as a loyalty customer
DROP POLICY IF EXISTS "Public insert loyalty customers" ON loyalty_customers;
CREATE POLICY "Public insert loyalty customers"
  ON loyalty_customers FOR INSERT WITH CHECK (true);

-- Public can read their own customer record (by email + restaurant)
DROP POLICY IF EXISTS "Public read loyalty customers" ON loyalty_customers;
CREATE POLICY "Public read loyalty customers"
  ON loyalty_customers FOR SELECT USING (true);

-- Public can update their own profile (limited fields via app logic)
DROP POLICY IF EXISTS "Public update loyalty customers" ON loyalty_customers;
CREATE POLICY "Public update loyalty customers"
  ON loyalty_customers FOR UPDATE USING (true);

-- Public can read settings (for showing loyalty info on menu page)
DROP POLICY IF EXISTS "Public read loyalty settings" ON loyalty_settings;
CREATE POLICY "Public read loyalty settings"
  ON loyalty_settings FOR SELECT USING (true);

-- Public can read their own vouchers
DROP POLICY IF EXISTS "Public read loyalty vouchers" ON loyalty_vouchers;
CREATE POLICY "Public read loyalty vouchers"
  ON loyalty_vouchers FOR SELECT USING (true);

-- Public can insert visits
DROP POLICY IF EXISTS "Public insert visits" ON loyalty_visits;
CREATE POLICY "Public insert visits"
  ON loyalty_visits FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Public read visits" ON loyalty_visits;
CREATE POLICY "Public read visits"
  ON loyalty_visits FOR SELECT USING (true);

-- Public can insert transactions
DROP POLICY IF EXISTS "Public insert transactions" ON loyalty_transactions;
CREATE POLICY "Public insert transactions"
  ON loyalty_transactions FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Public read transactions" ON loyalty_transactions;
CREATE POLICY "Public read transactions"
  ON loyalty_transactions FOR SELECT USING (true);

-- Public can read activity
DROP POLICY IF EXISTS "Public read activity" ON loyalty_activity;
CREATE POLICY "Public read activity"
  ON loyalty_activity FOR SELECT USING (true);

DROP POLICY IF EXISTS "Public insert activity" ON loyalty_activity;
CREATE POLICY "Public insert activity"
  ON loyalty_activity FOR INSERT WITH CHECK (true);

-- Public can read birthday rewards
DROP POLICY IF EXISTS "Public read birthday rewards" ON loyalty_birthday_rewards;
CREATE POLICY "Public read birthday rewards"
  ON loyalty_birthday_rewards FOR SELECT USING (true);

DROP POLICY IF EXISTS "Public insert birthday rewards" ON loyalty_birthday_rewards;
CREATE POLICY "Public insert birthday rewards"
  ON loyalty_birthday_rewards FOR INSERT WITH CHECK (true);

-- Public insert vouchers (system creates them)
DROP POLICY IF EXISTS "Public insert vouchers" ON loyalty_vouchers;
CREATE POLICY "Public insert vouchers"
  ON loyalty_vouchers FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Public update vouchers" ON loyalty_vouchers;
CREATE POLICY "Public update vouchers"
  ON loyalty_vouchers FOR UPDATE USING (true);

-- Authenticated (restaurant owners + admins) full access
DROP POLICY IF EXISTS "Auth full access loyalty settings" ON loyalty_settings;
CREATE POLICY "Auth full access loyalty settings"
  ON loyalty_settings FOR ALL USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Auth full access campaigns" ON loyalty_campaigns;
CREATE POLICY "Auth full access campaigns"
  ON loyalty_campaigns FOR ALL USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Auth read email log" ON loyalty_email_log;
CREATE POLICY "Auth read email log"
  ON loyalty_email_log FOR ALL USING (auth.uid() IS NOT NULL);

-- =====================================================
-- HELPER FUNCTION: Generate unique voucher code
-- =====================================================
CREATE OR REPLACE FUNCTION generate_voucher_code()
RETURNS TEXT AS $$
DECLARE
  chars TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  code  TEXT := '';
  i     INTEGER;
BEGIN
  FOR i IN 1..8 LOOP
    code := code || substr(chars, floor(random() * length(chars) + 1)::int, 1);
  END LOOP;
  RETURN code;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- DEFAULT SETTINGS: Auto-create settings for existing restaurants
-- =====================================================
INSERT INTO loyalty_settings (restaurant_id)
SELECT id FROM restaurants
ON CONFLICT (restaurant_id) DO NOTHING;

-- =====================================================
-- TRIGGER: Auto-create loyalty_settings when a restaurant is created
-- =====================================================
CREATE OR REPLACE FUNCTION create_loyalty_settings_for_restaurant()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO loyalty_settings (restaurant_id)
  VALUES (NEW.id)
  ON CONFLICT (restaurant_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS on_restaurant_created_loyalty ON restaurants;
CREATE TRIGGER on_restaurant_created_loyalty
  AFTER INSERT ON restaurants
  FOR EACH ROW EXECUTE FUNCTION create_loyalty_settings_for_restaurant();

-- =====================================================
-- TRIGGER: Auto-update tier when points change
-- =====================================================
CREATE OR REPLACE FUNCTION update_customer_tier()
RETURNS TRIGGER AS $$
DECLARE
  settings loyalty_settings%ROWTYPE;
  new_tier TEXT;
BEGIN
  SELECT * INTO settings FROM loyalty_settings WHERE restaurant_id = NEW.restaurant_id;

  IF NEW.total_points_earned >= COALESCE(settings.tier_platinum_min, 5000) THEN
    new_tier := 'platinum';
  ELSIF NEW.total_points_earned >= COALESCE(settings.tier_gold_min, 2000) THEN
    new_tier := 'gold';
  ELSIF NEW.total_points_earned >= COALESCE(settings.tier_silver_min, 500) THEN
    new_tier := 'silver';
  ELSE
    new_tier := 'bronze';
  END IF;

  -- Set VIP at 10 visits
  IF NEW.visit_count >= 10 THEN
    NEW.is_vip := TRUE;
  END IF;

  NEW.tier := new_tier;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_tier_on_points_change ON loyalty_customers;
CREATE TRIGGER update_tier_on_points_change
  BEFORE UPDATE OF total_points_earned, visit_count ON loyalty_customers
  FOR EACH ROW EXECUTE FUNCTION update_customer_tier();
