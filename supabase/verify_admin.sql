-- =====================================================
-- AR MENU PLATFORM — ADMIN VERIFICATION SCRIPT
-- =====================================================
-- If you are seeing "Requires Super Admin role" errors, 
-- run this script to ensure your account is correctly set up.

-- 1. Check your UUID in Supabase Auth > Users
-- 2. Replace 'YOUR-UUID-HERE' below and run the script.

-- INSERT INTO users (id, email, role)
-- VALUES ('YOUR-UUID-HERE', 'admin@armenu.app', 'super_admin')
-- ON CONFLICT (id) DO UPDATE SET role = 'super_admin';

-- 🔍 RUN THIS TO CHECK CURRENT STATUS:
SELECT u.id, u.email, u.role, u.restaurant_id
FROM users u
WHERE u.role = 'super_admin';

-- 🔍 CHECK IF ANY USER HAS THE ROLE:
-- SELECT count(*) FROM users WHERE role = 'super_admin';
