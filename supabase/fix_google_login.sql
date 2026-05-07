-- =====================================================
-- FIX: GOOGLE LOGIN REDIRECT LOOP
-- Automates profile creation & restaurant linking
-- =====================================================

-- 1. Create the trigger function
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
    found_restaurant_id UUID;
BEGIN
    -- Try to find a restaurant by owner_email matching the new user's email
    SELECT id INTO found_restaurant_id 
    FROM public.restaurants 
    WHERE owner_email = NEW.email 
    LIMIT 1;

    -- Insert into our public.users table
    INSERT INTO public.users (id, email, role, restaurant_id)
    VALUES (
        NEW.id, 
        NEW.email, 
        'restaurant', 
        found_restaurant_id
    )
    ON CONFLICT (id) DO UPDATE 
    SET restaurant_id = EXCLUDED.restaurant_id,
        email = EXCLUDED.email;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Create the trigger (dropped first if exists to avoid errors)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 3. Sync existing users who might be missing profiles
INSERT INTO public.users (id, email, role, restaurant_id)
SELECT 
    au.id, 
    au.email, 
    'restaurant', 
    (SELECT id FROM public.restaurants r WHERE r.owner_email = au.email LIMIT 1)
FROM auth.users au
LEFT JOIN public.users pu ON au.id = pu.id
WHERE pu.id IS NULL
ON CONFLICT (id) DO NOTHING;
