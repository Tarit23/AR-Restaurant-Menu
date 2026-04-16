-- =====================================================
-- FIX: MENU ITEMS RLS POLICIES
-- =====================================================

-- 1. Drop existing policies
DROP POLICY IF EXISTS "Super admin full access on menu_items" ON menu_items;
DROP POLICY IF EXISTS "Restaurant users manage own menu" ON menu_items;

-- 2. Create updated Super Admin policy (Enables INSERT as well)
CREATE POLICY "Super admin full access on menu_items"
  ON menu_items FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
        AND users.role = 'super_admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
        AND users.role = 'super_admin'
    )
  );

-- 3. Create updated Restaurant Owner policy (Enables INSERT as well)
CREATE POLICY "Restaurant users manage own menu"
  ON menu_items FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
        AND users.restaurant_id = menu_items.restaurant_id
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
        AND users.restaurant_id = menu_items.restaurant_id
    )
  );

-- 4. Enable RLS (Should already be enabled)
ALTER TABLE menu_items ENABLE ROW LEVEL SECURITY;
