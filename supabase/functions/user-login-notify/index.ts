import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { EMAIL_TEMPLATES } from "../_shared/email-templates.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')
    const { email, device, ip } = await req.json()

    if (!email) throw new Error('Email is required')

    // Only attempt if API key is present
    if (RESEND_API_KEY && RESEND_API_KEY !== 'REPLACE_WITH_RESEND_KEY') {
      const time = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })
      try {
        await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${RESEND_API_KEY}`
          },
          body: JSON.stringify({
            from: 'AR Menu Security <no-reply@armenu.app>',
            to: [email],
            subject: `Security Alert: New login detected`,
            html: EMAIL_TEMPLATES.loginAlert({
              email,
              time,
              device: device || 'Unknown Device',
              ip: ip || 'Unknown IP'
            })
          })
        })
      } catch (e) {
        console.error('Failed to send login alert:', e.message)
      }
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200
    })

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400
    })
  }
})
