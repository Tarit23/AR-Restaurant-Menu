import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const { restaurantId, plan, email, name } = await req.json()
    console.log(`[Subscription] Creating request for ${name} (${email}) - Plan: ${plan}`)
    
    const RAZORPAY_KEY_ID = Deno.env.get('RAZORPAY_KEY_ID')
    const RAZORPAY_KEY_SECRET = Deno.env.get('RAZORPAY_KEY_SECRET')
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
    const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || Deno.env.get('SERVICE_ROLE_KEY')

    if (!RAZORPAY_KEY_ID || !RAZORPAY_KEY_SECRET) {
      throw new Error('Razorpay keys not configured in Supabase secrets.')
    }

    const auth = btoa(`${RAZORPAY_KEY_ID}:${RAZORPAY_KEY_SECRET}`)
    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)

    // 1. Create or Get Razorpay Customer
    let customerId;
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
          fail_existing: 0
        })
      })
      const customerData = await customerRes.json()
      if (customerData.error) throw new Error(customerData.error.description)
      customerId = customerData.id
      console.log(`[Subscription] Customer ID: ${customerId}`)
    } catch (err) {
      console.error('[Subscription] Customer Error:', err)
      throw new Error(`Failed to create Razorpay customer: ${err.message}`)
    }

    // 2. Define Plan IDs
    const PLAN_IDS = {
      'basic': Deno.env.get('RAZORPAY_PLAN_BASIC_ID'),
      'pro': Deno.env.get('RAZORPAY_PLAN_PRO_ID')
    }

    const planId = PLAN_IDS[plan]
    if (!planId) {
      throw new Error(`Plan ID for "${plan}" not configured in environment (RAZORPAY_PLAN_${plan.toUpperCase()}_ID).`)
    }

    // 3. Create Subscription
    console.log(`[Subscription] Creating subscription for plan ${planId}`)
    const subRes = await fetch('https://api.razorpay.com/v1/subscriptions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${auth}`
      },
      body: JSON.stringify({
        plan_id: planId,
        customer_id: customerId,
        total_count: 12, // 1 year
        quantity: 1,
        customer_notify: 1,
        notes: {
          restaurant_id: restaurantId,
          plan: plan
        }
      })
    })

    const subData = await subRes.json()

    if (subData.error) {
      console.error('[Subscription] Razorpay API Error:', subData.error)
      throw new Error(`Razorpay Error: ${subData.error.description}`)
    }

    console.log(`[Subscription] Subscription ID: ${subData.id}`)

    // 4. Update Restaurant in DB
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
      throw new Error(`Failed to update restaurant record: ${updateError.message}`)
    }

    return new Response(JSON.stringify({
      id: subData.id,
      customer_id: customerId,
      entity: subData.entity,
      plan_id: subData.plan_id,
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
