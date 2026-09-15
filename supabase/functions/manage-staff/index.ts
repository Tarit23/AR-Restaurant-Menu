import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4"
import { authorizeUser } from "../_shared/rbac.ts"
import { validateEmail, validatePhone } from "../_shared/validators.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-user-token',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
    const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || Deno.env.get('SERVICE_ROLE_KEY')
    if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
      throw new Error('Supabase environment variables not configured.')
    }

    const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)

    // 1. Authenticate user from request header (x-user-token or Authorization)
    const userToken = req.headers.get('x-user-token')
    if (!userToken) {
      return new Response(JSON.stringify({ error: "Authentication token required." }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 401
      })
    }

    const { data: { user: authUser }, error: tokenErr } = await supabaseAdmin.auth.getUser(userToken)
    if (tokenErr || !authUser) {
      return new Response(JSON.stringify({ error: "Invalid user token." }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 401
      })
    }

    // 2. Parse request payload
    const body = await req.json()
    const { action, restaurantId, email, name, phone, password, role, staffId, status } = body

    if (!action || !restaurantId) {
      return new Response(JSON.stringify({ error: "Action and restaurantId are required." }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400
      })
    }

    // 3. Authorize: check if user has 'staff.manage' permission on this restaurant
    const authCheck = await authorizeUser(supabaseAdmin, authUser.id, 'staff.manage', restaurantId)
    if (!authCheck.authorized) {
      return new Response(JSON.stringify({ error: authCheck.error }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 403
      })
    }

    // --- Action Routing ---

    if (action === 'list') {
      // List all staff members for the restaurant (excluding super admins)
      const { data: staffList, error: fetchErr } = await supabaseAdmin
        .from('users')
        .select('*')
        .eq('restaurant_id', restaurantId)
        .neq('role', 'super_admin')

      if (fetchErr) throw fetchErr

      return new Response(JSON.stringify({ success: true, staff: staffList }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      })

    } else if (action === 'create') {
      // Create a staff user (auth account + profile record)
      if (!email || !name || !role || !password) {
        return new Response(JSON.stringify({ error: "email, name, role, and password are required." }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400
        })
      }

      if (!validateEmail(email)) {
        return new Response(JSON.stringify({ error: "Invalid email format." }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400
        })
      }

      const validRoles = ['manager', 'cashier', 'kitchen', 'waiter']
      if (!validRoles.includes(role)) {
        return new Response(JSON.stringify({ error: `Invalid role. Choose from: ${validRoles.join(', ')}` }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400
        })
      }

      // Check if user already exists
      const { data: users, error: checkErr } = await supabaseAdmin.auth.admin.listUsers()
      if (checkErr) throw checkErr
      const existing = users?.users.find(u => u.email?.toLowerCase() === email.toLowerCase())
      if (existing) {
        return new Response(JSON.stringify({ error: "User already exists with this email." }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400
        })
      }

      // Create Auth User
      const { data: newAuthUser, error: createAuthErr } = await supabaseAdmin.auth.admin.createUser({
        email: email.toLowerCase(),
        password: password,
        email_confirm: true,
        user_metadata: { role, restaurant_id: restaurantId, owner_name: name }
      })

      if (createAuthErr) throw createAuthErr

      // Create profile row
      const { error: profileErr } = await supabaseAdmin
        .from('users')
        .insert([{
          id: newAuthUser.user.id,
          email: email.toLowerCase(),
          role: role,
          restaurant_id: restaurantId,
          display_name: name,
          phone: phone || null,
          is_active: true
        }])

      if (profileErr) {
        await supabaseAdmin.auth.admin.deleteUser(newAuthUser.user.id)
        throw profileErr
      }

      return new Response(JSON.stringify({ success: true, message: "Staff created successfully." }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      })

    } else if (action === 'delete') {
      if (!staffId) {
        return new Response(JSON.stringify({ error: "staffId is required." }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400
        })
      }

      // Ensure staff belongs to this restaurant
      const { data: targetStaff, error: getErr } = await supabaseAdmin
        .from('users')
        .select('restaurant_id')
        .eq('id', staffId)
        .maybeSingle()

      if (getErr || !targetStaff) {
        return new Response(JSON.stringify({ error: "Staff member not found." }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 404
        })
      }

      if (targetStaff.restaurant_id !== restaurantId) {
        return new Response(JSON.stringify({ error: "Access Denied: staff mismatch." }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 403
        })
      }

      // Delete Auth User (cascades or drops profile record based on DB config, but let's delete both)
      await supabaseAdmin.from('users').delete().eq('id', staffId)
      const { error: delAuthErr } = await supabaseAdmin.auth.admin.deleteUser(staffId)
      if (delAuthErr) throw delAuthErr

      return new Response(JSON.stringify({ success: true, message: "Staff removed successfully." }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      })

    } else if (action === 'toggle-status') {
      if (!staffId || status === undefined) {
        return new Response(JSON.stringify({ error: "staffId and status (boolean) are required." }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400
        })
      }

      // Update active state
      const { error: updateErr } = await supabaseAdmin
        .from('users')
        .update({ is_active: status })
        .eq('id', staffId)
        .eq('restaurant_id', restaurantId)

      if (updateErr) throw updateErr

      return new Response(JSON.stringify({ success: true, message: `Staff status updated.` }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      })
    }

    throw new Error("Invalid staff action.")

  } catch (error) {
    console.error('MANAGE_STAFF_ERROR:', error)
    return new Response(JSON.stringify({ error: error.message || "An unexpected error occurred." }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500
    })
  }
})
