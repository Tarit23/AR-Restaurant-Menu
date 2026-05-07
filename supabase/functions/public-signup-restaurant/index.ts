import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4"
import { EMAIL_TEMPLATES } from "../_shared/email-templates.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-user-token',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
    const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || Deno.env.get('SERVICE_ROLE_KEY')
    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')

    if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
      throw new Error('Supabase environment variables are not configured.')
    }

    const { restaurantName, ownerName, email, password } = await req.json()
    console.log(`Signup request received for: ${email}`)

    // Hardcoded Super Admin check
    const isSuperAdmin = email.toLowerCase() === 'tarinmoymukherjee@gmail.com'
    const targetRole = isSuperAdmin ? 'super_admin' : 'restaurant'

    if (!restaurantName || !ownerName || !email || !password) {
      throw new Error('All fields are required: restaurantName, ownerName, email, password.')
    }

    const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)

    // 1. Create Restaurant record
    console.log(`Step 1: Creating restaurant record [${restaurantName}]`)
    const { data: restaurant, error: restError } = await supabaseAdmin
      .from('restaurants')
      .insert([{ 
        name: restaurantName, 
        owner_email: email, 
        plan: 'basic', 
        subscription_status: 'active' 
      }])
      .select()
      .single()

    if (restError) {
      console.error('Restaurant Insert Error:', restError)
      throw new Error(`Database Error (Restaurants): ${restError.message}`)
    }
    console.log(`Restaurant created with ID: ${restaurant.id}`)

    // 2. Create or Get Auth User
    console.log(`Step 2: Managing auth user for ${email}`)
    let userId;
    const { data: userList, error: listError } = await supabaseAdmin.auth.admin.listUsers()
    if (listError) {
      console.error('Auth List Error:', listError)
      throw new Error(`Auth Admin Error (List): ${listError.message}`)
    }

    const foundUser = userList?.users.find(u => u.email === email)

    if (foundUser) {
      console.log(`User already exists (UUID: ${foundUser.id}). Updating metadata...`)
      userId = foundUser.id
      const { error: updateAuthError } = await supabaseAdmin.auth.admin.updateUserById(userId, {
        user_metadata: { role: targetRole, restaurant_id: restaurant.id, owner_name: ownerName }
      })
      if (updateAuthError) {
        console.error('Auth Update Error:', updateAuthError)
        throw new Error(`Auth Admin Error (Update): ${updateAuthError.message}`)
      }
    } else {
      console.log(`Creating new auth user...`)
      const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email: email,
        password: password,
        email_confirm: true,
        user_metadata: { role: targetRole, restaurant_id: restaurant.id, owner_name: ownerName }
      })

      if (authError) {
        console.error('Auth Creation Error:', authError)
        await supabaseAdmin.from('restaurants').delete().eq('id', restaurant.id)
        throw new Error(`Auth Admin Error (Create): ${authError.message}`)
      }
      userId = authUser.user.id
      console.log(`New user created with UUID: ${userId}`)
    }

    // 3. Upsert User profile record
    console.log(`Step 3: Upserting profile for user ${userId} with role ${targetRole}`)
    const { error: profileError } = await supabaseAdmin
      .from('users')
      .upsert([{ 
        id: userId, 
        email: email, 
        role: targetRole, 
        restaurant_id: restaurant.id 
      }], { onConflict: 'id' })

    if (profileError) {
      console.error('Profile Upsert Error:', profileError)
      if (!foundUser) await supabaseAdmin.auth.admin.deleteUser(userId)
      await supabaseAdmin.from('restaurants').delete().eq('id', restaurant.id)
      throw new Error(`Database Error (Profiles): ${profileError.message}`)
    }
    console.log('Profile upserted successfully.')

    // 4. Send Emails via Resend (Optional)
    const ACTUAL_RESEND_KEY = RESEND_API_KEY || 're_CwtwqYHh_Pfdtw5qbJCowTiNYW12QTrYL'
    if (ACTUAL_RESEND_KEY && ACTUAL_RESEND_KEY !== 'REPLACE_WITH_RESEND_KEY') {
      try {
        console.log('Step 4: Dispatching notifications...')
        const time = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })

        // A. Welcome Email to Owner
        const welcomeRes = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${ACTUAL_RESEND_KEY}` },
          body: JSON.stringify({
            from: 'AR Menu <no-reply@armenu.app>',
            to: [email],
            subject: `Welcome to AR Menu - ${restaurantName} is live!`,
            html: EMAIL_TEMPLATES.welcome({
              restaurantName,
              email,
              password,
              loginUrl: 'https://ar-restaurant-menu-eta.vercel.app/login.html'
            })
          })
        })
        if (!welcomeRes.ok) console.warn('Welcome email failed:', await welcomeRes.text())

        // B. Alert to Super Admin
        const alertRes = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${ACTUAL_RESEND_KEY}` },
          body: JSON.stringify({
            from: 'SaaS Platform <no-reply@armenu.app>',
            to: ['admin@armenu.app'],
            subject: `New Restaurant Signup: ${restaurantName}`,
            html: EMAIL_TEMPLATES.signupAlert({
              restaurantName,
              ownerName,
              email,
              time
            })
          })
        })
        if (!alertRes.ok) console.warn('Admin alert email failed:', await alertRes.text())
        
      } catch (emailErr) {
        console.warn('Email process encountered an error:', emailErr.message)
      }
    } else {
      console.warn('No Resend API Key found. Skipping emails.')
    }

    return new Response(JSON.stringify({ success: true, restaurantId: restaurant.id, userId }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200
    })

  } catch (error) {
    console.error('SIGNUP_CRITICAL_FAILURE:', error.message)
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400
    })
  }
})
