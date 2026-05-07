import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4"
import { EMAIL_TEMPLATES } from "../_shared/email-templates.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-user-token',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

Deno.serve(async (req) => {
  // Handle CORS Preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { 
      status: 200, 
      headers: corsHeaders 
    })
  }

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
    const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')
    const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || Deno.env.get('SERVICE_ROLE_KEY')
    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') || 're_CwtwqYHh_Pfdtw5qbJCowTiNYW12QTrYL'

    if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SERVICE_ROLE_KEY) {
      throw new Error('Missing environment variables. Please set SERVICE_ROLE_KEY in your project secrets.')
    }

    const supabaseClient = createClient(
      SUPABASE_URL,
      SUPABASE_ANON_KEY
    )

    // 1. Get current user manually from custom header
    // This bypasses the Gateway bug with ES256 tokens
    const userToken = req.headers.get('x-user-token')
    if (!userToken) throw new Error('Unauthorized: No user token provided.')

    // Use Admin Client to verify the token directly with Auth
    const adminClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)
    
    console.log('Verifying user token...')
    const { data: { user }, error: userError } = await adminClient.auth.getUser(userToken)
    
    if (userError || !user) {
      console.error('Token verification failed:', userError)
      throw new Error('Unauthorized: Invalid session token.')
    }

    // 2. Check if super_admin
    const { data: profile, error: profileError } = await adminClient
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profileError || profile?.role !== 'super_admin') {
      console.error('Permission Denied:', profileError || `User role is ${profile?.role}`)
      throw new Error(`Permission Denied: Requires Super Admin role. Current role: ${profile?.role || 'Guest'}`)
    }

    // 3. Extract request body
    const { name, owner_email, plan, subscription_status, autopay_enabled, password } = await req.json()

    if (!name || !owner_email || !plan || !password) {
      throw new Error('Missing required fields: name, owner_email, plan, and password are required.')
    }

    // 4. Admin Client is already initialized at step 1

    // 5. Create Restaurant record
    console.log(`Creating restaurant: ${name} for ${owner_email}`)
    const { data: restaurant, error: restError } = await adminClient
      .from('restaurants')
      .insert([{ 
        name, 
        owner_email, 
        plan, 
        subscription_status: subscription_status || 'pending', 
        autopay_enabled: !!autopay_enabled 
      }])
      .select()
      .single()

    if (restError) {
      console.error('Restaurant Insert Error:', restError)
      throw new Error(`Database Error (Restaurants): ${restError.message}`)
    }

    // 6. Create or Get Auth User
    console.log(`Checking for existing auth user: ${owner_email}`)
    let userId;
    const { data: existingUser } = await adminClient.auth.admin.listUsers()
    const foundUser = existingUser?.users.find(u => u.email === owner_email)

    if (foundUser) {
      console.log(`User already exists with UUID: ${foundUser.id}. Updating metadata...`)
      userId = foundUser.id
      const { error: updateAuthError } = await adminClient.auth.admin.updateUserById(userId, {
        user_metadata: { role: 'restaurant', restaurant_id: restaurant.id }
      })
      if (updateAuthError) {
        console.error('Auth User Update Error:', updateAuthError)
        throw new Error(`Failed to update existing user: ${updateAuthError.message}`)
      }
    } else {
      console.log(`Creating new auth user for ${owner_email}`)
      const { data: authUser, error: authError } = await adminClient.auth.admin.createUser({
        email: owner_email,
        password: password,
        email_confirm: true,
        user_metadata: { role: 'restaurant', restaurant_id: restaurant.id }
      })

      if (authError) {
        console.error('Auth User Creation Error:', authError)
        // Rollback restaurant creation if auth fails
        await adminClient.from('restaurants').delete().eq('id', restaurant.id)
        throw new Error(`Auth Error: ${authError.message}`)
      }
      userId = authUser.user.id
    }

    // 7. Upsert User profile record
    console.log(`Upserting user profile for UUID: ${userId}`)
    const { error: userTableError } = await adminClient
      .from('users')
      .upsert([{ 
        id: userId, 
        email: owner_email, 
        role: 'restaurant', 
        restaurant_id: restaurant.id 
      }], { onConflict: 'id' })

    if (userTableError) {
      console.error('User Profile Upsert Error:', userTableError)
      // Cleanup: only if we created a new user, maybe don't delete if it was existing
      if (!foundUser) {
        await adminClient.auth.admin.deleteUser(userId)
      }
      await adminClient.from('restaurants').delete().eq('id', restaurant.id)
      throw new Error(`Database Error (Users): ${userTableError.message}`)
    }

    // 8. Send Welcome Email via Resend (Optional)
    if (RESEND_API_KEY && RESEND_API_KEY !== 'REPLACE_WITH_RESEND_KEY') {
      console.log(`Sending welcome email to ${owner_email}`)
      try {
        const emailRes = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${RESEND_API_KEY}`
          },
          body: JSON.stringify({
            from: 'AR Menu <no-reply@armenu.app>',
            to: [owner_email],
            subject: `Welcome to AR Menu - your portal is ready!`,
            html: EMAIL_TEMPLATES.welcome({
              restaurantName: name,
              email: owner_email,
              password: password,
              loginUrl: 'https://ar-restaurant-menu-eta.vercel.app/login.html'
            })
          })
        })

        if (!emailRes.ok) {
          const errData = await emailRes.json()
          console.error('Resend Error:', errData)
        } else {
          console.log('Welcome email sent successfully')
        }
      } catch (e) {
        console.error('Failed to trigger welcome email:', e.message)
      }
    } else {
      console.warn('RESEND_API_KEY not found. Skipping welcome email.')
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Restaurant and owner created successfully', 
        restaurantId: restaurant.id 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )

  } catch (error) {
    console.error('Function execution failed:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    )
  }
})
