import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4"
import { validateEmail } from "../_shared/validators.ts"
import { checkRateLimit } from "../_shared/rate-limiter.ts"
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

    const { email } = await req.json()
    if (!email || !validateEmail(email)) {
      return new Response(JSON.stringify({ error: "Please enter a valid email address." }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400
      })
    }

    const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)

    // Rate limiter check
    const clientIp = req.headers.get("x-forwarded-for") || "unknown"
    const rateCheckIp = await checkRateLimit(supabaseAdmin, `fp_ip_${clientIp}`, 5, 15)
    const rateCheckEmail = await checkRateLimit(supabaseAdmin, `fp_email_${email}`, 3, 15)

    if (!rateCheckIp.allowed || !rateCheckEmail.allowed) {
      return new Response(JSON.stringify({ 
        error: "Too many password reset requests. Please try again after 15 minutes." 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 429
      })
    }

    // Check if user exists in auth or profile table
    const { data: userList, error: listError } = await supabaseAdmin.auth.admin.listUsers()
    if (listError) throw listError
    const user = userList?.users.find(u => u.email?.toLowerCase() === email.toLowerCase())
    if (!user) {
      // Return success anyway for security / email enumeration prevention
      return new Response(JSON.stringify({ success: true, message: "If this email exists, a reset code has been sent." }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      })
    }

    // Generate 6-Digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString()
    const otpHash = await sha256(otp)
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString() // 10 mins

    // Clear previous reset OTPs
    await supabaseAdmin
      .from('email_verifications')
      .delete()
      .eq('email', email.toLowerCase())
      .eq('purpose', 'password_reset')

    // Store in email_verifications table
    const { error: insertError } = await supabaseAdmin
      .from('email_verifications')
      .insert([{
        email: email.toLowerCase(),
        otp_hash: otpHash,
        expires_at: expiresAt,
        purpose: 'password_reset',
        metadata: { ownerName: user.user_metadata?.owner_name || 'User' }
      }])

    if (insertError) throw insertError

    // Send Reset OTP email
    if (RESEND_API_KEY && RESEND_API_KEY !== 'REPLACE_WITH_RESEND_KEY') {
      const emailRes = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json', 
          'Authorization': `Bearer ${RESEND_API_KEY}` 
        },
        body: JSON.stringify({
          from: 'AR Menu Security <no-reply@armenu.app>',
          to: [email],
          subject: 'Password Reset Request',
          html: EMAIL_TEMPLATES.resetPasswordOtp({ 
            ownerName: user.user_metadata?.owner_name || 'User', 
            otp 
          })
        })
      })
      if (!emailRes.ok) console.error('Reset email failed:', await emailRes.text())
    } else {
      console.log(`Development Mode: Reset OTP for ${email} is ${otp}`)
    }

    return new Response(JSON.stringify({ success: true, message: "Verification code sent to email." }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200
    })

  } catch (error) {
    console.error('FORGOT_PASSWORD_ERROR:', error)
    return new Response(JSON.stringify({ error: error.message || "An unexpected error occurred." }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500
    })
  }
})
