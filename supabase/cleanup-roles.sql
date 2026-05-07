-- =====================================================
-- ROLE CLEANUP & SUPER ADMIN LOCK
-- Run this in the Supabase SQL Editor
-- =====================================================

-- 1. Reset all users to restaurant role (except the chosen one)
UPDATE public.users 
SET role = 'restaurant' 
WHERE email != 'tarinmoymukherjee@gmail.com';

-- 2. Promote ONLY the specific email to super_admin
-- Ensure this user exists in public.users. If not, the trigger will handle it or you can manually insert.
UPDATE public.users 
SET role = 'super_admin',
    restaurant_id = NULL
WHERE email = 'tarinmoymukherjee@gmail.com';

-- 3. Sync all Auth Users to the public.users table with correct roles
INSERT INTO public.users (id, email, role, restaurant_id)
SELECT 
  au.id, 
  au.email, 
  CASE WHEN au.email = 'tarinmoymukherjee@gmail.com' THEN 'super_admin' ELSE 'restaurant' END,
  (SELECT id FROM public.restaurants r WHERE r.owner_email = au.email LIMIT 1)
FROM auth.users au
ON CONFLICT (id) DO UPDATE 
SET 
  role = CASE WHEN EXCLUDED.email = 'tarinmoymukherjee@gmail.com' THEN 'super_admin' ELSE 'restaurant' END,
  restaurant_id = CASE WHEN EXCLUDED.email = 'tarinmoymukherjee@gmail.com' THEN NULL ELSE (SELECT id FROM public.restaurants r WHERE r.owner_email = EXCLUDED.email LIMIT 1) END,
  email = EXCLUDED.email;

-- 4. Update the trigger function to be more strict and explicit
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
DECLARE
  found_restaurant_id UUID;
  new_role TEXT := 'restaurant';
BEGIN
  -- Strictly designate super admin by email
  IF NEW.email = 'tarinmoymukherjee@gmail.com' THEN
    new_role := 'super_admin';
  END IF;

  -- Try to find a restaurant by owner_email matching the new user's email
  SELECT id INTO found_restaurant_id 
  FROM public.restaurants 
  WHERE owner_email = NEW.email 
  LIMIT 1;

  INSERT INTO public.users (id, email, role, restaurant_id)
  VALUES (NEW.id, NEW.email, new_role, found_restaurant_id)
  ON CONFLICT (id) DO UPDATE 
  SET role = EXCLUDED.role,
      restaurant_id = EXCLUDED.restaurant_id,
      email = EXCLUDED.email;
      
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Re-apply trigger to ensure it's active
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 6. Cleanup any orphaned admins in auth metadata
-- (Optional: run this if you want metadata to match)
-- UPDATE auth.users SET raw_user_meta_data = jsonb_set(raw_user_meta_data, '{role}', '"restaurant"') WHERE email != 'tarinmoymukherjee@gmail.com';
-- UPDATE auth.users SET raw_user_meta_data = jsonb_set(raw_user_meta_data, '{role}', '"super_admin"') WHERE email = 'tarinmoymukherjee@gmail.com';
