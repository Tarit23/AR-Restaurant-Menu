import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4"
import { checkRateLimit, resetRateLimit } from "../_shared/rate-limiter.ts"
import { EMAIL_TEMPLATES } from "../_shared/email-templates.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-user-token',
}

async function sha256(text: string): Promise<string> {
  const data = new TextEncoder().encode(text);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
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

    const { email, otp, purpose } = await req.json()
    if (!email || !otp || !purpose) {
      return new Response(JSON.stringify({ error: "Missing required fields." }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400
      })
    }

    const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)

    // 1. Fetch verification details
    const { data: ver, error: verError } = await supabaseAdmin
      .from('email_verifications')
      .select('*')
      .eq('email', email.toLowerCase())
      .eq('purpose', purpose)
      .eq('verified', false)
      .maybeSingle()

    if (verError || !ver) {
      return new Response(JSON.stringify({ error: "Invalid or expired verification session." }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400
      })
    }

    // 2. Expiry check
    if (new Date(ver.expires_at) < new Date()) {
      return new Response(JSON.stringify({ error: "Verification code has expired. Please request a new one." }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400
      })
    }

    // 3. Max attempts check
    const currentAttempts = ver.attempts + 1
    if (currentAttempts > 5) {
      // Invalidate, generate new OTP
      const newOtp = Math.floor(100000 + Math.random() * 900000).toString()
      const newHash = await sha256(newOtp)
      const newExpiry = new Date(Date.now() + 10 * 60 * 1000).toISOString()

      await supabaseAdmin
        .from('email_verifications')
        .update({ otp_hash: newHash, expires_at: newExpiry, attempts: 0 })
        .eq('id', ver.id)

      if (RESEND_API_KEY && RESEND_API_KEY !== 'REPLACE_WITH_RESEND_KEY') {
        const template = purpose === 'signup' 
          ? EMAIL_TEMPLATES.verificationOtp({ ownerName: ver.metadata?.ownerName || 'User', otp: newOtp })
          : EMAIL_TEMPLATES.resetPasswordOtp({ ownerName: ver.metadata?.ownerName || 'User', otp: newOtp })

        await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${RESEND_API_KEY}` },
          body: JSON.stringify({
            from: 'AR Menu <no-reply@armenu.app>',
            to: [email],
            subject: purpose === 'signup' ? 'Verify Your Restaurant Account' : 'Password Reset Request',
            html: template
          })
        })
      }

      return new Response(JSON.stringify({ 
        error: "Too many failed attempts. A new verification code has been sent to your email." 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400
      })
    }

    // 4. Validate OTP match
    const hashedInput = await sha256(otp)
    if (hashedInput !== ver.otp_hash) {
      await supabaseAdmin
        .from('email_verifications')
        .update({ attempts: currentAttempts })
        .eq('id', ver.id)

      return new Response(JSON.stringify({ 
        error: `Invalid code. ${5 - currentAttempts} attempts remaining.` 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400
      })
    }

    // 5. Successful OTP verification
    if (purpose === 'signup') {
      const { restaurantName, ownerName, phone, password, address, gstNumber, restaurantType, tableCount } = ver.metadata

      // A. Create Restaurant Record
      const { data: restaurant, error: restError } = await supabaseAdmin
        .from('restaurants')
        .insert([{
          name: restaurantName,
          owner_email: email.toLowerCase(),
          plan: 'basic',
          subscription_status: 'active'
        }])
        .select()
        .single()

      if (restError) throw restError

      // B. Create Supabase Auth User
      const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email: email.toLowerCase(),
        password: password,
        email_confirm: true, // Mark verified!
        user_metadata: { 
          role: 'restaurant_owner', 
          restaurant_id: restaurant.id, 
          owner_name: ownerName 
        }
      })

      if (authError) {
        // Rollback restaurant creation
        await supabaseAdmin.from('restaurants').delete().eq('id', restaurant.id)
        throw authError
      }

      const userId = authUser.user.id

      // C. Create profile row in users table
      const { error: profileError } = await supabaseAdmin
        .from('users')
        .insert([{
          id: userId,
          email: email.toLowerCase(),
          role: 'restaurant_owner',
          restaurant_id: restaurant.id,
          display_name: ownerName,
          phone: phone,
          is_active: true
        }])

      if (profileError) {
        // Rollback auth user & restaurant
        await supabaseAdmin.auth.admin.deleteUser(userId)
        await supabaseAdmin.from('restaurants').delete().eq('id', restaurant.id)
        throw profileError
      }

      // D. Generate Table rows automatically
      const tablesList = []
      const maxTables = parseInt(tableCount, 10) || 0
      for (let i = 1; i <= maxTables; i++) {
        tablesList.push({
          restaurant_id: restaurant.id,
          table_number: i,
          capacity: 4,
          status: 'available'
        })
      }
      if (tablesList.length > 0) {
        const { error: tablesError } = await supabaseAdmin
          .from('tables')
          .insert(tablesList)
        if (tablesError) console.error("Error auto-generating tables:", tablesError)
      }

      // Mark verified
      await supabaseAdmin
        .from('email_verifications')
        .update({ verified: true })
        .eq('id', ver.id)

      // Send Welcome Confirmation Email
      if (RESEND_API_KEY && RESEND_API_KEY !== 'REPLACE_WITH_RESEND_KEY') {
        await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${RESEND_API_KEY}` },
          body: JSON.stringify({
            from: 'AR Menu <no-reply@armenu.app>',
            to: [email],
            subject: `Welcome to AR Menu - ${restaurantName} is live!`,
            html: EMAIL_TEMPLATES.welcome({
              restaurantName,
              email: email.toLowerCase(),
              password: 'Your chosen password',
              loginUrl: 'https://ar-restaurant-menu-eta.vercel.app/login.html'
            })
          })
        })
      }

      return new Response(JSON.stringify({ 
        success: true, 
        message: "Email verified & account activated successfully." 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      })

    } else if (purpose === 'password_reset') {
      // Mark verified but do not reset password yet (returns a validation flag to frontend)
      await supabaseAdmin
        .from('email_verifications')
        .update({ verified: true })
        .eq('id', ver.id)

      return new Response(JSON.stringify({ 
        success: true, 
        message: "OTP verified. You can now reset your password." 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      })
    }

    throw new Error("Invalid verification purpose.")

  } catch (error) {
    console.error('VERIFY_OTP_ERROR:', error)
    return new Response(JSON.stringify({ error: error.message || "An unexpected error occurred." }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500
    })
  }
})
