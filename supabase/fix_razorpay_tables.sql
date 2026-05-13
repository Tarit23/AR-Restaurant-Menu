-- Fix Razorpay Tables & Logging
-- Run this in the Supabase SQL Editor

-- 1. Ensure payment_logs has plan column
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='payment_logs' AND column_name='plan') THEN
        ALTER TABLE payment_logs ADD COLUMN plan TEXT;
    END IF;
END $$;

-- 2. Ensure restaurants has necessary columns
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='restaurants' AND column_name='razorpay_customer_id') THEN
        ALTER TABLE restaurants ADD COLUMN razorpay_customer_id TEXT;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='restaurants' AND column_name='razorpay_subscription_id') THEN
        ALTER TABLE restaurants ADD COLUMN razorpay_subscription_id TEXT;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='restaurants' AND column_name='autopay_enabled') THEN
        ALTER TABLE restaurants ADD COLUMN autopay_enabled BOOLEAN DEFAULT FALSE;
    END IF;
END $$;

-- 3. Add index for faster webhook lookups
CREATE INDEX IF NOT EXISTS idx_restaurants_razorpay_sub ON restaurants(razorpay_subscription_id);

-- 4. Enable RLS on payment_logs (if not already enabled)
ALTER TABLE payment_logs ENABLE ROW LEVEL SECURITY;

-- 5. Public Insert for webhooks (via Service Role usually bypasses this, but good for safety)
DROP POLICY IF EXISTS "Webhook insert payment logs" ON payment_logs;
CREATE POLICY "Webhook insert payment logs" ON payment_logs FOR INSERT WITH CHECK (true);

-- 6. Super Admin view all logs
DROP POLICY IF EXISTS "Super admin view all logs" ON payment_logs;
CREATE POLICY "Super admin view all logs" ON payment_logs FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'super_admin'
    )
);
