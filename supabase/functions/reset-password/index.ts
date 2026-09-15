import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4"
import { validatePasswordStrength } from "../_shared/validators.ts"

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

    if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
      throw new Error('Supabase environment variables are not configured.')
    }

    const { email, otp, newPassword } = await req.json()
    if (!email || !otp || !newPassword) {
      return new Response(JSON.stringify({ error: "Missing required fields." }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400
      })
    }

    const pwdCheck = validatePasswordStrength(newPassword)
    if (!pwdCheck.valid) {
      return new Response(JSON.stringify({ error: pwdCheck.error }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400
      })
    }

    const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)

    // 1. Verify OTP has been successfully verified (verified = true)
    const hashedInput = await sha256(otp)
    const { data: ver, error: verError } = await supabaseAdmin
      .from('email_verifications')
      .select('*')
      .eq('email', email.toLowerCase())
      .eq('otp_hash', hashedInput)
      .eq('purpose', 'password_reset')
      .eq('verified', true)
      .maybeSingle()

    if (verError || !ver) {
      return new Response(JSON.stringify({ error: "OTP verification not completed or invalid." }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400
      })
    }

    // 2. Fetch the auth user ID matching this email
    const { data: userList, error: listError } = await supabaseAdmin.auth.admin.listUsers()
    if (listError) throw listError
    const user = userList?.users.find(u => u.email?.toLowerCase() === email.toLowerCase())
    if (!user) {
      return new Response(JSON.stringify({ error: "User account not found." }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 404
      })
    }

    // 3. Update the password
    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(user.id, {
      password: newPassword
    })

    if (updateError) throw updateError

    // 4. Delete the verification session so it cannot be reused
    await supabaseAdmin
      .from('email_verifications')
      .delete()
      .eq('id', ver.id)

    return new Response(JSON.stringify({ success: true, message: "Password updated successfully. You can now login." }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200
    })

  } catch (error) {
    console.error('RESET_PASSWORD_ERROR:', error)
    return new Response(JSON.stringify({ error: error.message || "An unexpected error occurred." }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500
    })
  }
})
