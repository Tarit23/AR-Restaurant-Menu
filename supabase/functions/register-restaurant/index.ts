import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4"
import { validateEmail, validatePhone, validatePasswordStrength } from "../_shared/validators.ts"
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

    const body = await req.json()
    const { 
      restaurantName, ownerName, email, phone, password, 
      address, gstNumber, restaurantType, tableCount 
    } = body

    // 1. Basic Fields Validation
    if (!restaurantName || !ownerName || !email || !phone || !password || !address || !restaurantType || !tableCount) {
      return new Response(JSON.stringify({ error: "All required fields must be filled." }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400
      })
    }

    // 2. Format Validation
    if (!validateEmail(email)) {
      return new Response(JSON.stringify({ error: "Invalid email format." }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400
      })
    }
    if (!validatePhone(phone)) {
      return new Response(JSON.stringify({ error: "Invalid phone number. Must be a valid 10-digit Indian number." }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400
      })
    }
    const pwdCheck = validatePasswordStrength(password)
    if (!pwdCheck.valid) {
      return new Response(JSON.stringify({ error: pwdCheck.error }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400
      })
    }

    const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)

    // 3. Rate Limiter (Email and IP based)
    const clientIp = req.headers.get("x-forwarded-for") || "unknown"
    const rateCheckIp = await checkRateLimit(supabaseAdmin, `reg_ip_${clientIp}`, 5, 60)
    const rateCheckEmail = await checkRateLimit(supabaseAdmin, `reg_email_${email}`, 3, 60)
    
    if (!rateCheckIp.allowed || !rateCheckEmail.allowed) {
      return new Response(JSON.stringify({ 
        error: "Too many registration attempts. Please try again after 1 hour." 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 429
      })
    }

    // 4. Check for duplicate email in Auth Users
    const { data: userList, error: listError } = await supabaseAdmin.auth.admin.listUsers()
    if (listError) throw listError
    const duplicate = userList?.users.some(u => u.email?.toLowerCase() === email.toLowerCase())
    if (duplicate) {
      return new Response(JSON.stringify({ error: "An account with this email address already exists." }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400
      })
    }

    // 5. Generate 6-Digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString()
    const otpHash = await sha256(otp)
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString() // 10 mins

    // 6. Delete previous pending verifications for this email
    await supabaseAdmin
      .from('email_verifications')
      .delete()
      .eq('email', email.toLowerCase())
      .eq('purpose', 'signup')

    // 7. Store in email_verifications table
    const { error: insertError } = await supabaseAdmin
      .from('email_verifications')
      .insert([{
        email: email.toLowerCase(),
        otp_hash: otpHash,
        expires_at: expiresAt,
        purpose: 'signup',
        metadata: {
          restaurantName, ownerName, phone, password, address, gstNumber, restaurantType, tableCount
        }
      }])

    if (insertError) throw insertError

    // 8. Send Verification OTP email via Resend
    if (RESEND_API_KEY && RESEND_API_KEY !== 'REPLACE_WITH_RESEND_KEY') {
      const emailRes = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json', 
          'Authorization': `Bearer ${RESEND_API_KEY}` 
        },
        body: JSON.stringify({
          from: 'AR Menu <no-reply@armenu.app>',
          to: [email],
          subject: 'Verify Your Restaurant Account',
          html: EMAIL_TEMPLATES.verificationOtp({ ownerName, otp })
        })
      })
      if (!emailRes.ok) {
        console.error('Email failed to send:', await emailRes.text())
      }
    } else {
      console.log(`Development Mode: OTP for ${email} is ${otp}`)
    }

    return new Response(JSON.stringify({ success: true, message: "Verification code sent to email." }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200
    })

  } catch (error) {
    console.error('REGISTER_RESTAURANT_ERROR:', error)
    return new Response(JSON.stringify({ error: error.message || "An unexpected error occurred." }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500
    })
  }
})
