import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    )

    // 1. Get current user
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser()
    if (userError || !user) throw new Error('Unauthorized')

    // 2. Check if super_admin
    const { data: profile, error: profileError } = await supabaseClient
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profileError || profile?.role !== 'super_admin') {
      throw new Error('User not allowed: Requires Super Admin role')
    }

    // 3. Extract request body
    const { name, owner_email, plan, subscription_status, autopay_enabled, password } = await req.json()

    if (!name || !owner_email || !plan || !password) {
      throw new Error('Missing required fields')
    }

    // 4. Use Admin Client (service_role) for Auth operations
    const adminClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // 5. Create Restaurant record
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

    if (restError) throw restError

    // 6. Create Auth User
    const { data: authUser, error: authError } = await adminClient.auth.admin.createUser({
      email: owner_email,
      password: password,
      email_confirm: true,
      user_metadata: { role: 'restaurant', restaurant_id: restaurant.id }
    })

    if (authError) {
      // Rollback restaurant creation if auth fails
      await adminClient.from('restaurants').delete().eq('id', restaurant.id)
      throw authError
    }

    // 7. Create User profile record
    const { error: userTableError } = await adminClient
      .from('users')
      .insert([{ 
        id: authUser.user.id, 
        email: owner_email, 
        role: 'restaurant', 
        restaurant_id: restaurant.id 
      }])

    if (userTableError) throw userTableError

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Restaurant and owner created successfully', 
        restaurantId: restaurant.id 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )

  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    )
  }
})
