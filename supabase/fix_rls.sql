-- =====================================================
-- AR MENU PLATFORM — FIX RLS & SECURITY
-- Run this script in the Supabase SQL Editor to resolve
-- the "Policy Exists RLS Disabled" warning and secure your data.
-- =====================================================

-- 1. ENABLE RLS ON ALL TABLES
-- This activates the security policies you have defined.
ALTER TABLE restaurants  ENABLE ROW LEVEL SECURITY;
ALTER TABLE users        ENABLE ROW LEVEL SECURITY;
ALTER TABLE menu_items   ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_logs ENABLE ROW LEVEL SECURITY;

-- 2. VERIFY POLICIES
-- Re-running these ensures they are active and correctly linked to the tables.

-- Allow public to see menu items (needed for the public menu page)
DROP POLICY IF EXISTS "Public read menu_items" ON menu_items;
CREATE POLICY "Public read menu_items" 
ON menu_items FOR SELECT 
USING (true);

-- Allow public to see restaurant details (needed for the public menu page)
DROP POLICY IF EXISTS "Public read restaurants" ON restaurants;
CREATE POLICY "Public read restaurants" 
ON restaurants FOR SELECT 
USING (true);

-- Allow users to see their own profiles
DROP POLICY IF EXISTS "Users read own profile" ON users;
CREATE POLICY "Users read own profile" 
ON users FOR SELECT 
USING (auth.uid() = id);

-- Allow Super Admin full access (using the helper function if it exists)
-- If is_admin() function was not created, this might fail, so we check first.
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'is_admin') THEN
        DROP POLICY IF EXISTS "Super admin full access on restaurants" ON restaurants;
        CREATE POLICY "Super admin full access on restaurants" ON restaurants FOR ALL USING (is_admin());
        
        DROP POLICY IF EXISTS "Super admin full access on menu_items" ON menu_items;
        CREATE POLICY "Super admin full access on menu_items" ON menu_items FOR ALL USING (is_admin());
        
        DROP POLICY IF EXISTS "Super admin full access on users" ON users;
        CREATE POLICY "Super admin full access on users" ON users FOR ALL USING (is_admin());
    END IF;
END $$;
