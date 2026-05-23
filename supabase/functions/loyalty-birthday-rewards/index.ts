import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4"
import { EMAIL_TEMPLATES } from "../_shared/email-templates.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function generateVoucherCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let rand = '';
  for (let i = 0; i < 4; i++) {
    rand += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `BDAY-${rand}`;
}

Deno.serve(async (req) => {
  // CORS Preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { status: 200, headers: corsHeaders })
  }

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
    const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || Deno.env.get('SERVICE_ROLE_KEY')
    const GLOBAL_RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')

    if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
      throw new Error('Missing Supabase environment variables.')
    }

    const adminClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)

    // Parse target date from body or use today
    let targetDateStr = new Date().toISOString().split('T')[0]
    try {
      const body = await req.json()
      if (body && body.date) {
        targetDateStr = body.date
      }
    } catch (_) {
      // Body empty or not JSON, ignore and use today
    }

    console.log(`Processing birthdays for date: ${targetDateStr}`)

    // 1. Get all customers having birthday today
    const { data: birthdays, error: rpcError } = await adminClient.rpc('get_todays_birthdays', {
      target_date: targetDateStr
    })

    if (rpcError) {
      console.error('Error invoking get_todays_birthdays RPC:', rpcError)
      throw new Error(`RPC Error: ${rpcError.message}`)
    }

    if (!birthdays || birthdays.length === 0) {
      console.log('No birthdays to process today.')
      return new Response(
        JSON.stringify({ success: true, message: 'No birthdays today', processed: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      )
    }

    console.log(`Found ${birthdays.length} birthday customer(s) to process.`)
    const currentYear = new Date(targetDateStr).getFullYear()
    const processedList = []

    for (const record of birthdays) {
      try {
        console.log(`Processing customer ${record.name} (${record.email}) for restaurant ${record.restaurant_name}...`)

        // 2. Check if already issued a birthday reward in current calendar year
        const { data: existing, error: selectError } = await adminClient
          .from('loyalty_birthday_rewards')
          .select('id')
          .eq('customer_id', record.id)
          .eq('claimed_year', currentYear)

        if (selectError) {
          console.error(`Error checking existing birthday reward for customer ${record.id}:`, selectError)
          continue
        }

        if (existing && existing.length > 0) {
          console.log(`Customer ${record.name} (${record.email}) already received birthday reward for year ${currentYear}. Skipping.`)
          continue
        }

        // 3. Generate voucher code
        const code = generateVoucherCode()
        const expiryDays = record.birthday_week_valid ? 7 : 30
        const expiryDate = new Date(new Date(targetDateStr).getTime() + expiryDays * 24 * 60 * 60 * 1000)
        const expiryStr = expiryDate.toISOString().split('T')[0]

        const voucherTitle = 'Birthday Gift'
        const voucherDesc = record.birthday_reward_description || 'Complimentary birthday item'
        const voucherValue = record.birthday_reward_value || 'Free Dessert'

        // 4. Create loyalty voucher
        const { data: voucher, error: voucherError } = await adminClient
          .from('loyalty_vouchers')
          .insert({
            restaurant_id: record.restaurant_id,
            customer_id: record.id,
            code: code,
            title: voucherTitle,
            description: voucherDesc,
            type: record.birthday_reward_type || 'free_item',
            value: voucherValue,
            min_spend: 0,
            expiry_date: expiryStr,
            status: 'active'
          })
          .select('id')
          .single()

        if (voucherError || !voucher) {
          console.error(`Failed to create voucher for ${record.name}:`, voucherError)
          continue
        }

        // 5. Save record in loyalty_birthday_rewards (to prevent double claims)
        const { error: lockError } = await adminClient
          .from('loyalty_birthday_rewards')
          .insert({
            customer_id: record.id,
            claimed_year: currentYear,
            voucher_id: voucher.id
          })

        if (lockError) {
          console.error(`Failed to lock birthday reward for ${record.name}:`, lockError)
          // Cleanup voucher
          await adminClient.from('loyalty_vouchers').delete().eq('id', voucher.id)
          continue
        }

        // 6. Add activity log
        await adminClient
          .from('loyalty_activity')
          .insert({
            restaurant_id: record.restaurant_id,
            customer_id: record.id,
            activity_type: 'birthday_reward',
            description: `Issued birthday voucher ${code} (${voucherValue})`,
            metadata: { voucher_id: voucher.id, code, year: currentYear }
          })

        // 7. Send Email via Resend
        const resendApiKey = record.resend_api_key || GLOBAL_RESEND_API_KEY
        const senderEmail = record.sender_email || 'no-reply@armenu.app'
        const senderName = record.sender_name || `${record.restaurant_name} Rewards`

        if (resendApiKey) {
          console.log(`Sending birthday email to ${record.email} via Resend...`)
          try {
            const formattedDate = new Date(expiryStr).toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
              year: 'numeric'
            })

            const emailHtml = EMAIL_TEMPLATES.loyaltyBirthdayReward({
              customerName: record.name,
              restaurantName: record.restaurant_name,
              voucherCode: code,
              voucherValue: voucherValue,
              voucherDesc: voucherDesc,
              expiryDate: formattedDate
            })

            const emailRes = await fetch('https://api.resend.com/emails', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${resendApiKey}`
              },
              body: JSON.stringify({
                from: `${senderName} <${senderEmail}>`,
                to: [record.email],
                subject: `Happy Birthday from ${record.restaurant_name}! 🎂🎁`,
                html: emailHtml
              })
            })

            if (!emailRes.ok) {
              const errDetails = await emailRes.text()
              console.error(`Resend API Error:`, errDetails)
            } else {
              console.log(`Birthday email sent to ${record.email}`)
            }
          } catch (emailErr) {
            console.error(`Email sending failed for ${record.email}:`, emailErr)
          }
        } else {
          console.warn(`Resend API Key is missing for customer ${record.email}. Skipping email.`)
        }

        processedList.push({
          customer_id: record.id,
          name: record.name,
          email: record.email,
          voucher_code: code
        })

      } catch (innerErr) {
        console.error(`Error processing birthday record for customer ${record.id}:`, innerErr)
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `Processed birthday rewards successfully`,
        processedCount: processedList.length,
        processed: processedList
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
