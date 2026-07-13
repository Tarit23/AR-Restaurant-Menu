-- =====================================================
-- ADD PAYMENT FIELDS (UPI, Payment Methods, Order Status)
-- Run this in the Supabase SQL Editor
-- =====================================================

-- 1. Add UPI ID to Restaurants table
ALTER TABLE public.restaurants 
ADD COLUMN IF NOT EXISTS upi_id TEXT;

-- 2. Add Payment details to Orders table
ALTER TABLE public.orders 
ADD COLUMN IF NOT EXISTS payment_method TEXT DEFAULT 'cash';

ALTER TABLE public.orders 
ADD COLUMN IF NOT EXISTS payment_status TEXT DEFAULT 'pending';
