import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const RAZORPAY_KEY_ID = Deno.env.get('RAZORPAY_KEY_ID')
    const RAZORPAY_KEY_SECRET = Deno.env.get('RAZORPAY_KEY_SECRET')
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
    const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || Deno.env.get('SERVICE_ROLE_KEY')

    if (!RAZORPAY_KEY_ID || !RAZORPAY_KEY_SECRET) {
      throw new Error('Razorpay keys not configured in Supabase secrets.')
    }

    const auth = btoa(`${RAZORPAY_KEY_ID}:${RAZORPAY_KEY_SECRET}`)
    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)

    // 1. Verify User Session (Manual JWT Check)
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) throw new Error('Missing Authorization header')
    
    const { data: { user }, error: authError } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''))
    if (authError || !user) throw new Error('Invalid or expired session. Please log in again.')

    const { restaurantId, plan, email, name } = await req.json()
    console.log(`[Subscription] Request: ${name} (${email}) - Plan: ${plan}, RestID: ${restaurantId}`)

    // 2. Security: Verify restaurant ownership
    const { data: profile, error: profileError } = await supabase
      .from('users')
      .select('restaurant_id')
      .eq('id', user.id)
      .single()

    if (profileError || profile.restaurant_id !== restaurantId) {
      console.error('[Subscription] Security breach attempt or config error:', { userId: user.id, restaurantId })
      throw new Error('You do not have permission to manage this restaurant.')
    }

    // 3. Get or Create Razorpay Customer
    const { data: restaurant } = await supabase
      .from('restaurants')
      .select('razorpay_customer_id')
      .eq('id', restaurantId)
      .single()

    let customerId = restaurant?.razorpay_customer_id

    if (!customerId) {
      console.log(`[Subscription] No customer ID found, creating new one for ${email}...`)
      try {
        const customerRes = await fetch('https://api.razorpay.com/v1/customers', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Basic ${auth}`
          },
          body: JSON.stringify({
            name,
            email,
            fail_existing: 0 // Will return existing if email matches
          })
        })
        const customerData = await customerRes.json()
        if (customerData.error) throw new Error(customerData.error.description)
        customerId = customerData.id
        console.log(`[Subscription] Customer ID obtained: ${customerId}`)
      } catch (err) {
        console.error('[Subscription] Customer Error:', err)
        throw new Error(`Failed to initialize Razorpay customer: ${err.message}`)
      }
    } else {
      console.log(`[Subscription] Reusing existing customer ID: ${customerId}`)
    }

    // 4. Define Plan IDs
    const PLAN_IDS = {
      'basic': Deno.env.get('RAZORPAY_PLAN_BASIC_ID') || 'plan_SmVN9PPiUNaOxG',
      'pro': Deno.env.get('RAZORPAY_PLAN_PRO_ID') || 'plan_SmVOECOgOcpnix'
    }

    const planId = PLAN_IDS[plan]
    if (!planId) {
      throw new Error(`Plan ID for "${plan}" not found. Ensure RAZORPAY_PLAN_${plan.toUpperCase()}_ID is set.`)
    }

    // 5. Create Subscription
    console.log(`[Subscription] Creating sub for plan ${planId}...`)
    const subRes = await fetch('https://api.razorpay.com/v1/subscriptions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${auth}`
      },
      body: JSON.stringify({
        plan_id: planId,
        customer_id: customerId,
        total_count: 120, // 10 years (effectively infinite for monthly)
        quantity: 1,
        customer_notify: 1,
        notes: {
          restaurant_id: restaurantId,
          plan: plan,
          user_id: user.id
        }
      })
    })

    const subData = await subRes.json()

    if (subData.error) {
      console.error('[Subscription] Razorpay API Error:', subData.error)
      throw new Error(`Razorpay Error: ${subData.error.description}`)
    }

    console.log(`[Subscription] Created successfully: ${subData.id}`)

    // 6. Update Restaurant Record
    const { error: updateError } = await supabase
      .from('restaurants')
      .update({
        razorpay_customer_id: customerId,
        razorpay_subscription_id: subData.id,
        subscription_status: 'pending',
        plan: plan
      })
      .eq('id', restaurantId)

    if (updateError) {
      console.error('[Subscription] DB Update Error:', updateError)
      throw new Error(`Database update failed: ${updateError.message}`)
    }

    return new Response(JSON.stringify({
      id: subData.id,
      customer_id: customerId,
      status: subData.status
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200
    })

  } catch (error) {
    console.error('[Subscription] Fatal Error:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400
    })
  }
})
