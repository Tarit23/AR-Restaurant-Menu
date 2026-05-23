import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4"
import { EMAIL_TEMPLATES } from "../_shared/email-templates.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
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

    // Parse input
    let campaignId: string | null = null
    try {
      const body = await req.json()
      if (body && body.campaign_id) {
        campaignId = body.campaign_id
      }
    } catch (_) {
      // Empty or invalid body
    }

    const processedCampaigns = []

    if (campaignId) {
      // ==========================================================
      // MODE A: Execute a specific manual/draft campaign
      // ==========================================================
      console.log(`Executing manual campaign ID: ${campaignId}`)

      // 1. Fetch Campaign
      const { data: campaign, error: campError } = await adminClient
        .from('loyalty_campaigns')
        .select('*')
        .eq('id', campaignId)
        .single()

      if (campError || !campaign) {
        throw new Error(`Campaign not found: ${campError?.message || 'No record'}`)
      }

      if (campaign.status === 'sent' || campaign.status === 'sending') {
        return new Response(
          JSON.stringify({ success: true, message: `Campaign is already ${campaign.status}` }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
        )
      }

      // Mark status as sending to avoid double sends
      await adminClient
        .from('loyalty_campaigns')
        .update({ status: 'sending' })
        .eq('id', campaignId)

      // 2. Fetch Restaurant Settings & Name
      const { data: settings } = await adminClient
        .from('loyalty_settings')
        .select('*')
        .eq('restaurant_id', campaign.restaurant_id)
        .single()

      const { data: restaurant } = await adminClient
        .from('restaurants')
        .select('name')
        .eq('id', campaign.restaurant_id)
        .single()

      const restaurantName = restaurant?.name || 'Our Restaurant'
      const resendApiKey = settings?.resend_api_key || GLOBAL_RESEND_API_KEY
      const senderEmail = settings?.sender_email || 'rewards@armenu.app'
      const senderName = settings?.sender_name || `${restaurantName} Rewards`

      if (!resendApiKey) {
        await adminClient.from('loyalty_campaigns').update({ status: 'failed' }).eq('id', campaignId)
        throw new Error(`No Resend API Key configured for campaign ${campaignId}`)
      }

      // 3. Get target customers
      const { data: targets, error: rpcError } = await adminClient.rpc('get_campaign_customers', {
        campaign_id: campaignId
      })

      if (rpcError) {
        await adminClient.from('loyalty_campaigns').update({ status: 'failed' }).eq('id', campaignId)
        throw new Error(`RPC Error fetching campaign customers: ${rpcError.message}`)
      }

      console.log(`Found ${targets?.length || 0} target customers for manual campaign.`)

      let sentCount = 0
      if (targets && targets.length > 0) {
        for (const target of targets) {
          try {
            // Get customer points
            const { data: wallet } = await adminClient
              .from('loyalty_wallets')
              .select('points')
              .eq('customer_id', target.customer_id)
              .single()

            const pointsBalance = wallet?.points || 0

            // Replace template variables
            let html = campaign.body_html
              .replace(/\{\{name\}\}/g, target.name || 'Valued Guest')
              .replace(/\{\{points\}\}/g, String(pointsBalance))

            // Check if we want to send it wrapped in a standard template or raw
            // If the user's template is raw HTML, we send it. Otherwise, we can send it directly.
            // Let's replace name in subject too
            const finalSubject = campaign.subject.replace(/\{\{name\}\}/g, target.name || 'Valued Guest')

            const emailRes = await fetch('https://api.resend.com/emails', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${resendApiKey}`
              },
              body: JSON.stringify({
                from: `${senderName} <${senderEmail}>`,
                to: [target.email],
                subject: finalSubject,
                html: html
              })
            })

            if (emailRes.ok) {
              sentCount++
              // Log activity
              await adminClient
                .from('loyalty_activity')
                .insert({
                  restaurant_id: campaign.restaurant_id,
                  customer_id: target.customer_id,
                  activity_type: 'campaign_receive',
                  description: `Received campaign email: "${campaign.name}"`,
                  metadata: { campaign_id: campaignId }
                })
            } else {
              console.error(`Resend failed for ${target.email}: ${await emailRes.text()}`)
            }
          } catch (innerErr) {
            console.error(`Error sending email to ${target.email}:`, innerErr)
          }
        }
      }

      // Update Campaign Status
      await adminClient
        .from('loyalty_campaigns')
        .update({
          status: 'sent',
          sent_at: new Date().toISOString(),
          sent_count: sentCount
        })
        .eq('id', campaignId)

      processedCampaigns.push({
        campaign_id: campaignId,
        sent_count: sentCount
      })

    } else {
      // ==========================================================
      // MODE B: Weekly automated promos cron run
      // ==========================================================
      console.log('Running automated weekly promotional cron...')

      // 1. Get all restaurants with weekly promo enabled
      const { data: settingsList, error: settingsError } = await adminClient
        .from('loyalty_settings')
        .select('*')
        .eq('weekly_promo_enabled', true)

      if (settingsError) {
        throw new Error(`Error fetching loyalty settings: ${settingsError.message}`)
      }

      if (!settingsList || settingsList.length === 0) {
        console.log('No restaurants have weekly promo enabled.')
        return new Response(
          JSON.stringify({ success: true, message: 'No restaurants enabled' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
        )
      }

      console.log(`Found ${settingsList.length} restaurants with weekly promo enabled.`)

      for (const settings of settingsList) {
        try {
          const restaurantId = settings.restaurant_id
          const resendApiKey = settings.resend_api_key || GLOBAL_RESEND_API_KEY
          const senderEmail = settings.sender_email || 'rewards@armenu.app'

          if (!resendApiKey) {
            console.warn(`No Resend API Key for restaurant ${restaurantId}. Skipping weekly promo.`)
            continue
          }

          // Fetch restaurant details
          const { data: restaurant } = await adminClient
            .from('restaurants')
            .select('name')
            .eq('id', restaurantId)
            .single()

          const restaurantName = restaurant?.name || 'Our Restaurant'
          const senderName = settings.sender_name || `${restaurantName} Rewards`

          // Get active offers for the weekly promo email
          // We add default visits milestone offers:
          const offersList = [
            settings.visit_3_reward ? `3 Visits: Get ${settings.visit_3_reward}` : '3 Visits: Free Dessert',
            settings.visit_5_reward ? `5 Visits: Get ${settings.visit_5_reward}` : '5 Visits: ₹200 Coupon',
            settings.visit_10_reward ? `10 Visits: Get ${settings.visit_10_reward}` : '10 Visits: VIP Membership & ₹500 Coupon'
          ]

          // Query custom rewards from loyalty_rewards catalog
          const { data: customRewards } = await adminClient
            .from('loyalty_rewards')
            .select('title, description')
            .eq('restaurant_id', restaurantId)
            .eq('is_active', true)
            .limit(3)

          if (customRewards && customRewards.length > 0) {
            customRewards.forEach(r => {
              offersList.push(`${r.title} — ${r.description || 'Exclusive loyalty reward'}`)
            })
          }

          // Create a new campaign entry
          const campaignName = `Weekly Promo Newsletter — ${new Date().toISOString().split('T')[0]}`
          const subjectText = `Your Weekend Specials are here at ${restaurantName}! 🎉`

          const { data: campaign, error: createCampErr } = await adminClient
            .from('loyalty_campaigns')
            .insert({
              restaurant_id: restaurantId,
              name: campaignName,
              type: 'weekly_promo',
              subject: subjectText,
              body_html: `Automated weekly promo containing offers: ${offersList.join(' | ')}`,
              target_segment: 'all',
              status: 'sending'
            })
            .select()
            .single()

          if (createCampErr || !campaign) {
            console.error(`Failed to create campaign record for weekly newsletter:`, createCampErr)
            continue
          }

          // Get all opted-in customers for this restaurant
          const { data: customers } = await adminClient
            .from('loyalty_customers')
            .select('id, name, email')
            .eq('restaurant_id', restaurantId)
            .eq('opted_in_email', true)

          console.log(`Restaurant ${restaurantName}: Found ${customers?.length || 0} customer(s) to email.`)

          let sentCount = 0
          if (customers && customers.length > 0) {
            for (const customer of customers) {
              try {
                // Get points balance
                const { data: wallet } = await adminClient
                  .from('loyalty_wallets')
                  .select('points')
                  .eq('customer_id', customer.id)
                  .single()

                const pointsBalance = wallet?.points || 0

                const emailHtml = EMAIL_TEMPLATES.loyaltyWeeklyPromo({
                  customerName: customer.name,
                  restaurantName: restaurantName,
                  points: pointsBalance,
                  offers: offersList
                })

                const emailRes = await fetch('https://api.resend.com/emails', {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${resendApiKey}`
                  },
                  body: JSON.stringify({
                    from: `${senderName} <${senderEmail}>`,
                    to: [customer.email],
                    subject: subjectText,
                    html: emailHtml
                  })
                })

                if (emailRes.ok) {
                  sentCount++
                  // Log activity
                  await adminClient
                    .from('loyalty_activity')
                    .insert({
                      restaurant_id: restaurantId,
                      customer_id: customer.id,
                      activity_type: 'campaign_receive',
                      description: `Received weekly newsletter: "${campaignName}"`,
                      metadata: { campaign_id: campaign.id }
                    })
                }
              } catch (innerErr) {
                console.error(`Error emailing ${customer.email} in weekly cron:`, innerErr)
              }
            }
          }

          // Update status to sent
          await adminClient
            .from('loyalty_campaigns')
            .update({
              status: 'sent',
              sent_at: new Date().toISOString(),
              sent_count: sentCount
            })
            .eq('id', campaign.id)

          processedCampaigns.push({
            campaign_id: campaign.id,
            restaurant: restaurantName,
            sent_count: sentCount
          })

        } catch (restErr) {
          console.error(`Error processing weekly newsletter for settings ID ${settings.id}:`, restErr)
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Campaign processing complete',
        processed: processedCampaigns
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
