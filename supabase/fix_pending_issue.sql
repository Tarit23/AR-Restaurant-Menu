
-- Update the handle_new_user function to automatically create a restaurant for new users
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
DECLARE
  found_restaurant_id UUID;
  new_role TEXT;
BEGIN
  -- 1. Determine role based on email (Case-insensitive)
  IF LOWER(NEW.email) = 'tarinmoymukherjee@gmail.com' THEN
    new_role := 'super_admin';
  ELSE
    new_role := 'restaurant';
  END IF;

  -- 2. Try to find a restaurant by owner_email matching the new user's email
  SELECT id INTO found_restaurant_id 
  FROM public.restaurants 
  WHERE LOWER(owner_email) = LOWER(NEW.email)
  LIMIT 1;

  -- 3. If no restaurant exists and it's not the super admin, create one
  IF found_restaurant_id IS NULL AND new_role = 'restaurant' THEN
    INSERT INTO public.restaurants (name, owner_email, plan, subscription_status)
    VALUES ('My Restaurant', NEW.email, 'basic', 'pending')
    RETURNING id INTO found_restaurant_id;
  END IF;

  -- 4. Upsert the user profile
  INSERT INTO public.users (id, email, role, restaurant_id)
  VALUES (NEW.id, NEW.email, new_role, found_restaurant_id)
  ON CONFLICT (id) DO UPDATE 
  SET restaurant_id = EXCLUDED.restaurant_id,
      email = EXCLUDED.email,
      role = EXCLUDED.role;
      
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Re-sync existing users who might be stuck in "pending"
-- This creates restaurants for anyone who doesn't have one and isn't admin
DO $$
DECLARE
  user_record RECORD;
  new_rest_id UUID;
BEGIN
  FOR user_record IN 
    SELECT id, email FROM public.users 
    WHERE role = 'restaurant' AND restaurant_id IS NULL
  LOOP
    -- Create restaurant
    INSERT INTO public.restaurants (name, owner_email, plan, subscription_status)
    VALUES ('My Restaurant', user_record.email, 'basic', 'pending')
    RETURNING id INTO new_rest_id;
    
    -- Link user
    UPDATE public.users SET restaurant_id = new_rest_id WHERE id = user_record.id;
  END LOOP;
END $$;
