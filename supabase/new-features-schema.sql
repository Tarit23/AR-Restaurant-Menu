-- =====================================================
-- NEW FEATURES SCHEMA — SUPABASE DATABASE MIGRATIONS
-- Run this in the Supabase SQL Editor
-- =====================================================

-- 1. ADD THEME SETTINGS TO RESTAURANTS
ALTER TABLE public.restaurants 
ADD COLUMN IF NOT EXISTS theme_settings JSONB DEFAULT '{
  "theme": "glassmorphism",
  "fontFamily": "Poppins",
  "primaryColor": "#6366f1",
  "secondaryColor": "#a855f7",
  "backgroundColor": "#0f172a",
  "cardColor": "rgba(30, 41, 59, 0.7)",
  "textColor": "#f8fafc",
  "buttonColor": "#6366f1",
  "buttonTextColor": "#ffffff",
  "buttonRadius": "12px",
  "welcomeTitle": "",
  "welcomeSubtitle": "",
  "logoUrl": "",
  "bannerUrl": ""
}'::jsonb;

-- 2. CREATE UPSELL RULES TABLE
CREATE TABLE IF NOT EXISTS public.upsell_rules (
  id              UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  restaurant_id   UUID REFERENCES public.restaurants(id) ON DELETE CASCADE NOT NULL,
  menu_item_id    UUID REFERENCES public.menu_items(id) ON DELETE CASCADE NOT NULL,
  upsell_item_ids UUID[] NOT NULL, -- Array of menu item UUIDs to suggest
  is_active       BOOLEAN DEFAULT TRUE,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(restaurant_id, menu_item_id)
);

CREATE INDEX IF NOT EXISTS idx_upsell_rules_menu_item ON public.upsell_rules(menu_item_id);

-- 3. CREATE ORDERS & ORDER ITEMS TABLES (Table Ordering Loop)
CREATE TABLE IF NOT EXISTS public.orders (
  id              UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  restaurant_id   UUID REFERENCES public.restaurants(id) ON DELETE CASCADE NOT NULL,
  customer_id     UUID REFERENCES public.loyalty_customers(id) ON DELETE SET NULL, -- Nullable if they don't join loyalty
  customer_email  TEXT,
  customer_name   TEXT,
  table_number    INTEGER NOT NULL,
  total_amount    NUMERIC(10, 2) NOT NULL DEFAULT 0,
  discount_amount NUMERIC(10, 2) NOT NULL DEFAULT 0,
  points_earned   INTEGER DEFAULT 0,
  status          TEXT NOT NULL DEFAULT 'pending' 
                  CHECK (status IN ('pending', 'preparing', 'ready', 'served', 'completed', 'cancelled')),
  voucher_code    TEXT, -- Applied coupon code
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_orders_restaurant ON public.orders(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_orders_customer   ON public.orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_orders_status     ON public.orders(status);

CREATE TABLE IF NOT EXISTS public.order_items (
  id            UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  order_id      UUID REFERENCES public.orders(id) ON DELETE CASCADE NOT NULL,
  menu_item_id  UUID REFERENCES public.menu_items(id) ON DELETE SET NULL,
  name          TEXT NOT NULL,
  quantity      INTEGER NOT NULL DEFAULT 1,
  price         NUMERIC(10, 2) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_order_items_order ON public.order_items(order_id);

-- 4. CREATE CUSTOMER FAVORITES TABLE
CREATE TABLE IF NOT EXISTS public.customer_favorites (
  id            UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  restaurant_id UUID REFERENCES public.restaurants(id) ON DELETE CASCADE NOT NULL,
  customer_id   UUID REFERENCES public.loyalty_customers(id) ON DELETE CASCADE NOT NULL,
  menu_item_id  UUID REFERENCES public.menu_items(id) ON DELETE CASCADE NOT NULL,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(customer_id, menu_item_id)
);

CREATE INDEX IF NOT EXISTS idx_cust_favs_customer ON public.customer_favorites(customer_id);

-- 5. ROW LEVEL SECURITY (RLS) POLICIES
ALTER TABLE public.upsell_rules      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_favorites ENABLE ROW LEVEL SECURITY;

-- ── Upsell Rules RLS ──
DROP POLICY IF EXISTS "Public select upsell rules" ON public.upsell_rules;
CREATE POLICY "Public select upsell rules" ON public.upsell_rules
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Auth full access upsell rules" ON public.upsell_rules;
CREATE POLICY "Auth full access upsell rules" ON public.upsell_rules
  FOR ALL USING (auth.uid() IS NOT NULL);

-- ── Orders & Items RLS ──
DROP POLICY IF EXISTS "Anyone can insert orders" ON public.orders;
CREATE POLICY "Anyone can insert orders" ON public.orders
  FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Public select own orders" ON public.orders;
CREATE POLICY "Public select own orders" ON public.orders
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Auth full access orders" ON public.orders;
CREATE POLICY "Auth full access orders" ON public.orders
  FOR ALL USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Anyone can insert order items" ON public.order_items;
CREATE POLICY "Anyone can insert order items" ON public.order_items
  FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Public select order items" ON public.order_items;
CREATE POLICY "Public select order items" ON public.order_items
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Auth full access order items" ON public.order_items;
CREATE POLICY "Auth full access order items" ON public.order_items
  FOR ALL USING (auth.uid() IS NOT NULL);

-- ── Favorites RLS ──
DROP POLICY IF EXISTS "Public full access favorites" ON public.customer_favorites;
CREATE POLICY "Public full access favorites" ON public.customer_favorites
  FOR ALL USING (true);

DROP POLICY IF EXISTS "Auth full access favorites" ON public.customer_favorites;
CREATE POLICY "Auth full access favorites" ON public.customer_favorites
  FOR ALL USING (auth.uid() IS NOT NULL);

-- =====================================================
-- 6. DB TRIGGER: Auto-credit loyalty points on completed orders
-- =====================================================
CREATE OR REPLACE FUNCTION public.process_completed_order_loyalty()
RETURNS TRIGGER AS $$
DECLARE
  earned_pts    INTEGER := 0;
  cust_points   INTEGER := 0;
  voucher_id    UUID;
BEGIN
  -- Trigger on order completion (pending/preparing -> completed)
  IF NEW.status = 'completed' AND OLD.status != 'completed' AND NEW.customer_id IS NOT NULL THEN
    
    -- Points earned: ₹100 = 10 pts (i.e. 10% of total paid bill)
    earned_pts := floor(NEW.total_amount * 0.1);
    
    IF earned_pts > 0 THEN
      -- Get current loyalty profile points
      SELECT points INTO cust_points FROM public.loyalty_customers WHERE id = NEW.customer_id;
      cust_points := COALESCE(cust_points, 0);

      -- Update loyalty customer profile details
      UPDATE public.loyalty_customers
      SET points = points + earned_pts,
          total_points_earned = total_points_earned + earned_pts,
          total_spent_amount = total_spent_amount + NEW.total_amount,
          visit_count = visit_count + 1,
          last_activity_at = NOW()
      WHERE id = NEW.customer_id;

      -- Insert record in loyalty_transactions ledger
      INSERT INTO public.loyalty_transactions (
        restaurant_id, customer_id, type, points, balance_after, description, reference_id
      ) VALUES (
        NEW.restaurant_id,
        NEW.customer_id,
        'earn',
        earned_pts,
        cust_points + earned_pts,
        'Earned from table order placement #' || substring(NEW.id::text, 1, 8),
        NEW.id::text
      );

      -- Record activity log
      INSERT INTO public.loyalty_activity (
        restaurant_id, customer_id, type, title, description, points_delta, icon
      ) VALUES (
        NEW.restaurant_id,
        NEW.customer_id,
        'points_earned',
        'Points Credited',
        'Earned ' || earned_pts || ' points from dining at Table ' || NEW.table_number,
        earned_pts,
        '🍽️'
      );
      
      -- Update points_earned in order row
      NEW.points_earned := earned_pts;
    END IF;

    -- If order had a voucher code, mark the voucher as used
    IF NEW.voucher_code IS NOT NULL AND NEW.voucher_code != '' THEN
      UPDATE public.loyalty_vouchers
      SET is_used = TRUE,
          used_at = NOW()
      WHERE code = NEW.voucher_code AND restaurant_id = NEW.restaurant_id;
    END IF;

  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_order_completed_loyalty ON public.orders;
CREATE TRIGGER trg_order_completed_loyalty
  BEFORE UPDATE OF status ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.process_completed_order_loyalty();
