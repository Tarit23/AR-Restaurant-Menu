
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
    const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || Deno.env.get('SERVICE_ROLE_KEY')

    if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
      throw new Error('Supabase environment variables are not configured.')
    }

    const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)

    // 1. Get user from Auth header
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) throw new Error('No authorization header')
    
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(authHeader.replace('Bearer ', ''))
    if (userError || !user) throw new Error('Invalid user token')

    const email = user.email
    const userId = user.id
    const isSuperAdmin = email.toLowerCase() === 'tarinmoymukherjee@gmail.com'
    const targetRole = isSuperAdmin ? 'super_admin' : 'restaurant'

    console.log(`Initializing profile for ${email} (${userId}) as ${targetRole}`)

    // 2. Check if profile already exists
    const { data: existingProfile } = await supabaseAdmin
      .from('users')
      .select('id, restaurant_id')
      .eq('id', userId)
      .maybeSingle()

    if (existingProfile && existingProfile.restaurant_id) {
       return new Response(JSON.stringify({ success: true, message: 'Profile already exists', profile: existingProfile }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      })
    }

    // 3. Find or Create Restaurant
    let restaurantId = existingProfile?.restaurant_id;

    if (!restaurantId && targetRole === 'restaurant') {
      console.log(`Searching for existing restaurant for ${email}`)
      const { data: existingRest } = await supabaseAdmin
        .from('restaurants')
        .select('id')
        .eq('owner_email', email)
        .maybeSingle()

      if (existingRest) {
        restaurantId = existingRest.id
        console.log(`Found existing restaurant: ${restaurantId}`)
      } else {
        console.log(`Creating new restaurant placeholder for ${email}`)
        const { data: newRest, error: restError } = await supabaseAdmin
          .from('restaurants')
          .insert([{ 
            name: 'My Restaurant', 
            owner_email: email, 
            plan: 'basic', 
            subscription_status: 'pending' 
          }])
          .select()
          .single()

        if (restError) throw new Error(`Database Error (Restaurants): ${restError.message}`)
        restaurantId = newRest.id
        console.log(`Created new restaurant: ${restaurantId}`)
      }
    }

    // 4. Upsert User Profile
    console.log(`Upserting profile...`)
    const { error: profileError } = await supabaseAdmin
      .from('users')
      .upsert([{ 
        id: userId, 
        email: email, 
        role: targetRole, 
        restaurant_id: restaurantId 
      }], { onConflict: 'id' })

    if (profileError) throw new Error(`Database Error (Profiles): ${profileError.message}`)

    // 5. Update Auth Metadata (for consistency)
    await supabaseAdmin.auth.admin.updateUserById(userId, {
      user_metadata: { role: targetRole, restaurant_id: restaurantId }
    })

    // 6. Send Welcome Email if it was a new profile
    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') || 're_CwtwqYHh_Pfdtw5qbJCowTiNYW12QTrYL'
    if (!existingProfile && targetRole === 'restaurant' && RESEND_API_KEY) {
      try {
        const time = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })
        await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${RESEND_API_KEY}` },
          body: JSON.stringify({
            from: 'AR Menu <no-reply@armenu.app>',
            to: [email],
            subject: `Welcome to AR Menu - Account Initialized!`,
            html: `
              <div style="font-family: sans-serif; padding: 20px; color: #333;">
                <h1 style="color: #6366f1;">Welcome to AR Menu!</h1>
                <p>Hello,</p>
                <p>Your account has been successfully initialized. You can now access your restaurant dashboard and start creating your AR menu.</p>
                <div style="background: #f3f4f6; padding: 15px; border-radius: 8px; margin: 20px 0;">
                  <strong>Login Email:</strong> ${email}<br>
                  <strong>Role:</strong> Restaurant Owner
                </div>
                <p>Visit your dashboard: <a href="https://ar-restaurant-menu-eta.vercel.app/restaurant/index.html">Dashboard Link</a></p>
                <p>If you have any questions, feel free to contact our support team.</p>
                <p>Best regards,<br>The AR Menu Team</p>
              </div>
            `
          })
        })
      } catch (e) {
        console.warn('Welcome email failed in init-user-profile:', e.message)
      }
    }

    return new Response(JSON.stringify({ 
      success: true, 
      restaurantId, 
      role: targetRole 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200
    })

  } catch (error) {
    console.error('Initialization Error:', error.message)
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400
    })
  }
})
