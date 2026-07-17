-- =====================================================
-- DINING SESSIONS & TABLE AUTOMATION Redesign Schema
-- Run this in your Supabase SQL Editor
-- =====================================================

-- 1. CREATE TABLES
CREATE TABLE IF NOT EXISTS public.tables (
  id                  UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  restaurant_id       UUID REFERENCES public.restaurants(id) ON DELETE CASCADE NOT NULL,
  table_number        INTEGER NOT NULL,
  capacity            INTEGER DEFAULT 4,
  status              TEXT DEFAULT 'available' 
                      CHECK (status IN ('available', 'seated', 'preparing', 'ready', 'dining', 'payment_pending', 'cleaning')),
  current_session_id  UUID, -- Nullable, references active dining session
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(restaurant_id, table_number)
);

CREATE TABLE IF NOT EXISTS public.dining_sessions (
  id                  UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  restaurant_id       UUID REFERENCES public.restaurants(id) ON DELETE CASCADE NOT NULL,
  table_id            UUID REFERENCES public.tables(id) ON DELETE CASCADE NOT NULL,
  customer_name       TEXT,
  customer_email      TEXT,
  customer_id         UUID REFERENCES public.loyalty_customers(id) ON DELETE SET NULL,
  start_time          TIMESTAMPTZ DEFAULT NOW(),
  end_time            TIMESTAMPTZ,
  status              TEXT DEFAULT 'active' CHECK (status IN ('active', 'completed')),
  running_total       NUMERIC(10, 2) DEFAULT 0,
  discount_amount     NUMERIC(10, 2) DEFAULT 0,
  voucher_code        TEXT,
  payment_method      TEXT DEFAULT 'cash',
  payment_status      TEXT DEFAULT 'unpaid' CHECK (payment_status IN ('unpaid', 'paid')),
  created_at          TIMESTAMPTZ DEFAULT NOW()
);

-- Add Self-Referential Constraint back to tables
ALTER TABLE public.tables 
DROP CONSTRAINT IF EXISTS fk_current_session;

ALTER TABLE public.tables 
ADD CONSTRAINT fk_current_session 
FOREIGN KEY (current_session_id) 
REFERENCES public.dining_sessions(id) ON DELETE SET NULL;

-- 2. MODIFY ORDERS TABLE
ALTER TABLE public.orders 
ADD COLUMN IF NOT EXISTS session_id UUID REFERENCES public.dining_sessions(id) ON DELETE CASCADE;

ALTER TABLE public.orders 
DROP CONSTRAINT IF EXISTS orders_status_check;

ALTER TABLE public.orders 
ADD CONSTRAINT orders_status_check 
CHECK (status IN ('new', 'accepted', 'preparing', 'ready', 'served', 'completed', 'cancelled'));

-- 3. CREATE CUSTOMER ASSISTANCE REQUESTS TABLE
CREATE TABLE IF NOT EXISTS public.customer_requests (
  id                  UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  restaurant_id       UUID REFERENCES public.restaurants(id) ON DELETE CASCADE NOT NULL,
  table_number        INTEGER NOT NULL,
  session_id          UUID REFERENCES public.dining_sessions(id) ON DELETE CASCADE NOT NULL,
  request_type        TEXT CHECK (request_type IN ('call_waiter', 'need_water', 'need_tissue', 'need_spoon', 'need_bill', 'need_extra_plates', 'need_cleaning')),
  status              TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'completed')),
  created_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_requests_restaurant ON public.customer_requests(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_requests_status     ON public.customer_requests(status);

-- 4. ROW LEVEL SECURITY (RLS) POLICIES
ALTER TABLE public.tables ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dining_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_requests ENABLE ROW LEVEL SECURITY;

-- Tables RLS
DROP POLICY IF EXISTS "Public select tables" ON public.tables;
CREATE POLICY "Public select tables" ON public.tables FOR SELECT USING (true);
DROP POLICY IF EXISTS "Anyone can insert tables" ON public.tables;
CREATE POLICY "Anyone can insert tables" ON public.tables FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "Anyone can update tables" ON public.tables;
CREATE POLICY "Anyone can update tables" ON public.tables FOR UPDATE USING (true);
DROP POLICY IF EXISTS "Auth full access tables" ON public.tables;
CREATE POLICY "Auth full access tables" ON public.tables FOR ALL USING (auth.uid() IS NOT NULL);

-- Dining Sessions RLS
DROP POLICY IF EXISTS "Anyone can select dining sessions" ON public.dining_sessions;
CREATE POLICY "Anyone can select dining sessions" ON public.dining_sessions FOR SELECT USING (true);
DROP POLICY IF EXISTS "Anyone can insert dining sessions" ON public.dining_sessions;
CREATE POLICY "Anyone can insert dining sessions" ON public.dining_sessions FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "Anyone can update dining sessions" ON public.dining_sessions;
CREATE POLICY "Anyone can update dining sessions" ON public.dining_sessions FOR UPDATE USING (true);
DROP POLICY IF EXISTS "Auth full access dining sessions" ON public.dining_sessions;
CREATE POLICY "Auth full access dining sessions" ON public.dining_sessions FOR ALL USING (auth.uid() IS NOT NULL);

-- Customer Requests RLS
DROP POLICY IF EXISTS "Anyone can select customer requests" ON public.customer_requests;
CREATE POLICY "Anyone can select customer requests" ON public.customer_requests FOR SELECT USING (true);
DROP POLICY IF EXISTS "Anyone can insert customer requests" ON public.customer_requests;
CREATE POLICY "Anyone can insert customer requests" ON public.customer_requests FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "Anyone can update customer requests" ON public.customer_requests;
CREATE POLICY "Anyone can update customer requests" ON public.customer_requests FOR UPDATE USING (true);
DROP POLICY IF EXISTS "Auth full access customer requests" ON public.customer_requests;
CREATE POLICY "Auth full access customer requests" ON public.customer_requests FOR ALL USING (auth.uid() IS NOT NULL);

-- 5. Force update Supabase's API schema cache
NOTIFY pgrst, 'reload schema';
