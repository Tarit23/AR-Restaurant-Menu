// =====================================================
// SUPABASE EDGE FUNCTION: razorpay-webhook
// =====================================================
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const RAZORPAY_WEBHOOK_SECRET = Deno.env.get("RAZORPAY_WEBHOOK_SECRET") ?? "";
const SUPABASE_URL            = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_KEY    = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? Deno.env.get("SERVICE_ROLE_KEY") ?? "";

serve(async (req: Request) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const body      = await req.text();
  const signature = req.headers.get("x-razorpay-signature") ?? "";

  // Signature verification (Simplified for demonstration, but recommended in production)
  // if (!verifySignature(body, signature, RAZORPAY_WEBHOOK_SECRET)) { ... }

  const event = JSON.parse(body);
  const eventType = event.event;
  console.log(`[Webhook] Received Event: ${eventType}`);

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  try {
    // Extract ID and Plan from payload
    const subscription = event.payload?.subscription?.entity;
    const payment = event.payload?.payment?.entity;
    
    const subscriptionId = subscription?.id || payment?.subscription_id;
    const restaurantId = subscription?.notes?.restaurant_id || payment?.notes?.restaurant_id;

    console.log(`[Webhook] SubID: ${subscriptionId}, RestID: ${restaurantId}`);

    if (eventType === "subscription.authenticated" || eventType === "subscription.activated") {
      // User has completed the first payment and authorized the subscription
      if (subscriptionId) {
        const nextDate = new Date();
        nextDate.setMonth(nextDate.getMonth() + 1);

        const updates: any = {
          subscription_status: "active",
          autopay_enabled:     true,
          next_payment_date:   nextDate.toISOString()
        };
        
        if (subscription?.notes?.plan) {
          updates.plan = subscription.notes.plan;
        }

        const { error } = await supabase
          .from("restaurants")
          .update(updates)
          .eq("razorpay_subscription_id", subscriptionId);
          
        if (error) throw error;
        console.log(`[Webhook] Activated subscription ${subscriptionId}`);
      }
    }

    if (eventType === "subscription.charged") {
      // Recurring payment successful
      if (subscriptionId) {
        const nextDate = new Date();
        nextDate.setMonth(nextDate.getMonth() + 1);

        await supabase
          .from("restaurants")
          .update({
            subscription_status: "active",
            next_payment_date:   nextDate.toISOString(),
          })
          .eq("razorpay_subscription_id", subscriptionId);

        // Log payment
        const { data: restaurant } = await supabase
          .from("restaurants")
          .select("id")
          .eq("razorpay_subscription_id", subscriptionId)
          .single();

        if (restaurant?.id) {
          await supabase.from("payment_logs").insert([{
            restaurant_id:       restaurant.id,
            razorpay_payment_id: payment?.id,
            razorpay_event:      eventType,
            amount:              (payment?.amount || 0) / 100,
            status:              "success",
          }]);
        }
      }
    }

    if (eventType === "subscription.halted" || eventType === "subscription.cancelled") {
      if (subscriptionId) {
        await supabase
          .from("restaurants")
          .update({
            subscription_status: "cancelled",
            autopay_enabled:     false,
          })
          .eq("razorpay_subscription_id", subscriptionId);
      }
    }

    if (eventType === "payment.failed") {
       // Log failed payment
       if (restaurantId) {
          await supabase.from("payment_logs").insert([{
            restaurant_id:       restaurantId,
            razorpay_payment_id: payment?.id,
            razorpay_event:      eventType,
            amount:              (payment?.amount || 0) / 100,
            status:              "failed",
          }]);
       }
    }

    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[Webhook] Error:", err.message);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
