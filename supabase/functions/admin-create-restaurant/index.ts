import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-user-token',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

serve(async (req) => {
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
    const SERVICE_ROLE_KEY = Deno.env.get('SERVICE_ROLE_KEY')

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

    // 6. Create Auth User
    console.log(`Creating auth user for ${owner_email}`)
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

    // 7. Create User profile record
    console.log(`Creating user profile for UUID: ${authUser.user.id}`)
    const { error: userTableError } = await adminClient
      .from('users')
      .insert([{ 
        id: authUser.user.id, 
        email: owner_email, 
        role: 'restaurant', 
        restaurant_id: restaurant.id 
      }])

    if (userTableError) {
      console.error('User Profile Insert Error:', userTableError)
      // Cleanup: delete auth user and restaurant on profile failure
      await adminClient.auth.admin.deleteUser(authUser.user.id)
      await adminClient.from('restaurants').delete().eq('id', restaurant.id)
      throw new Error(`Database Error (Users): ${userTableError.message}`)
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
