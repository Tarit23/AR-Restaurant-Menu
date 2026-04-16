// =====================================================
// SUPABASE CONFIGURATION
// ⚠️  Replace these values with your actual credentials
// =====================================================

const SUPABASE_URL      = 'https://fuezcrbfswgghawhfxrv.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ1ZXpjcmJmc3dnZ2hhd2hmeHJ2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYyMTMzNzIsImV4cCI6MjA5MTc4OTM3Mn0.wIhnSy1L-U9s-BH4UB7KE6Wf3nt-PyGyaKutMMsv0tk';

// =====================================================
// RAZORPAY CONFIGURATION
// =====================================================
const RAZORPAY_KEY_ID = 'YOUR_RAZORPAY_KEY_ID';

// =====================================================
// APP CONFIGURATION
// =====================================================
const APP_CONFIG = {
  name:   'AR Menu Platform',
  domain: 'https://ar-restaurant-menu-eta.vercel.app',  // ← update after deploying to Vercel
  plans: {
    basic: {
      id:       'plan_basic',
      name:     'Basic',
      price:    99900,       // paise  = ₹999/mo
      currency: 'INR',
      interval: 'monthly',
      features: [
        'Up to 20 menu items',
        'AR viewing (WebXR)',
        'QR code generation',
        'Basic support'
      ]
    },
    pro: {
      id:       'plan_pro',
      name:     'Professional',
      price:    249900,      // paise  = ₹2,499/mo
      currency: 'INR',
      interval: 'monthly',
      features: [
        'Unlimited menu items',
        'AR viewing (WebXR)',
        'QR code generation',
        'Analytics dashboard',
        'Priority support'
      ]
    },
    enterprise: {
      id:       'plan_enterprise',
      name:     'Enterprise',
      price:    499900,      // paise  = ₹4,999/mo
      currency: 'INR',
      interval: 'monthly',
      features: [
        'Everything in Pro',
        'Custom domain',
        'White-label option',
        'Dedicated account manager',
        'API access'
      ]
    }
  }
};

// =====================================================
// SUPABASE CLIENT INIT
// Works with: <script src="supabase CDN"> + type="module"
// The CDN sets window.supabase; we expose it cleanly here.
// =====================================================
if (!window.supabase) {
  throw new Error(
    '[AR Menu] Supabase CDN not loaded. Make sure the supabase CDN <script> tag appears BEFORE your module scripts.'
  );
}

const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    autoRefreshToken:    true,
    persistSession:      true,
    detectSessionInUrl:  true
  }
});

export { supabase, RAZORPAY_KEY_ID, APP_CONFIG };
