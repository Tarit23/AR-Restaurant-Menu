import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const { restaurantId, plan, email, name } = await req.json()
    
    const RAZORPAY_KEY_ID = Deno.env.get('RAZORPAY_KEY_ID')
    const RAZORPAY_KEY_SECRET = Deno.env.get('RAZORPAY_KEY_SECRET')
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
    const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || Deno.env.get('SERVICE_ROLE_KEY')

    if (!RAZORPAY_KEY_ID || !RAZORPAY_KEY_SECRET) {
      throw new Error('Razorpay keys not configured in environment.')
    }

    const auth = btoa(`${RAZORPAY_KEY_ID}:${RAZORPAY_KEY_SECRET}`)
    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)

    // 1. Create or Get Razorpay Customer
    console.log(`Processing customer for ${email}`)
    const customerRes = await fetch('https://api.razorpay.com/v1/customers', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${auth}`
      },
      body: JSON.stringify({
        name,
        email,
        fail_existing: 0 // If exists, return existing
      })
    })
    const customerData = await customerRes.json()
    const customerId = customerData.id

    // 2. Define Plan IDs (These should ideally be in env or DB)
    // Basic: plan_basic_id, Pro: plan_pro_id
    const PLAN_IDS = {
      'basic': Deno.env.get('RAZORPAY_PLAN_BASIC_ID') || 'plan_basic_placeholder',
      'pro': Deno.env.get('RAZORPAY_PLAN_PRO_ID') || 'plan_pro_placeholder'
    }

    const planId = PLAN_IDS[plan]
    if (!planId || planId.includes('placeholder')) {
      throw new Error(`Plan ID for "${plan}" not configured.`)
    }

    // 3. Create Subscription
    console.log(`Creating subscription for plan ${planId}`)
    const subRes = await fetch('https://api.razorpay.com/v1/subscriptions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${auth}`
      },
      body: JSON.stringify({
        plan_id: planId,
        customer_id: customerId,
        total_count: 12, // 1 year of monthly payments
        quantity: 1,
        customer_notify: 1,
        addons: [],
        notes: {
          restaurant_id: restaurantId
        }
      })
    })

    const subData = await subRes.json()

    if (subData.error) {
      throw new Error(`Razorpay Error: ${subData.error.description}`)
    }

    // 4. Update Restaurant in DB
    await supabase
      .from('restaurants')
      .update({
        razorpay_customer_id: customerId,
        razorpay_subscription_id: subData.id,
        subscription_status: 'pending'
      })
      .eq('id', restaurantId)

    return new Response(JSON.stringify(subData), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200
    })

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400
    })
  }
})
