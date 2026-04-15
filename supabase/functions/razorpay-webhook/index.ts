// =====================================================
// SUPABASE EDGE FUNCTION: razorpay-webhook
// Deploy to: supabase/functions/razorpay-webhook/index.ts
// =====================================================
// This handles incoming webhook events from Razorpay
// and updates the database accordingly.
//
// Deploy with:
//   supabase functions deploy razorpay-webhook
//
// Set secrets:
//   supabase secrets set RAZORPAY_WEBHOOK_SECRET=your_secret
// =====================================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { crypto } from "https://deno.land/std@0.168.0/crypto/mod.ts";

const RAZORPAY_WEBHOOK_SECRET = Deno.env.get("RAZORPAY_WEBHOOK_SECRET") ?? "";
const SUPABASE_URL            = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_KEY    = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

serve(async (req: Request) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const body      = await req.text();
  const signature = req.headers.get("x-razorpay-signature") ?? "";

  // Verify signature
  const encoder = new TextEncoder();
  const keyData = encoder.encode(RAZORPAY_WEBHOOK_SECRET);
  const bodyData = encoder.encode(body);

  const cryptoKey = await crypto.subtle.importKey(
    "raw", keyData, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
  );
  const sigBuf = await crypto.subtle.sign("HMAC", cryptoKey, bodyData);
  const expectedSig = Array.from(new Uint8Array(sigBuf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  if (expectedSig !== signature) {
    console.error("Invalid signature");
    return new Response("Unauthorized", { status: 401 });
  }

  const event = JSON.parse(body);
  console.log("Razorpay event:", event.event);

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  try {
    const eventType = event.event;

    // Extract subscription_id from various event shapes
    const subscriptionId =
      event.payload?.subscription?.entity?.id ||
      event.payload?.payment?.entity?.description ||
      null;

    if (eventType === "payment.captured" || eventType === "subscription.charged") {
      // Payment successful — update subscription status
      if (subscriptionId) {
        const nextDate = new Date();
        nextDate.setMonth(nextDate.getMonth() + 1);

        await supabase
          .from("restaurants")
          .update({
            subscription_status: "active",
            autopay_enabled:     true,
            next_payment_date:   nextDate.toISOString(),
          })
          .eq("razorpay_subscription_id", subscriptionId);

        // Log payment
        const restaurantRes = await supabase
          .from("restaurants")
          .select("id")
          .eq("razorpay_subscription_id", subscriptionId)
          .single();

        if (restaurantRes.data?.id) {
          await supabase.from("payment_logs").insert([{
            restaurant_id:       restaurantRes.data.id,
            razorpay_payment_id: event.payload?.payment?.entity?.id,
            razorpay_event:      eventType,
            amount:              (event.payload?.payment?.entity?.amount || 0) / 100,
            status:              "success",
          }]);
        }
      }
    }

    if (eventType === "payment.failed") {
      if (subscriptionId) {
        await supabase
          .from("restaurants")
          .update({
            subscription_status: "expired",
            autopay_enabled:     false,
          })
          .eq("razorpay_subscription_id", subscriptionId);

        const restaurantRes = await supabase
          .from("restaurants")
          .select("id")
          .eq("razorpay_subscription_id", subscriptionId)
          .single();

        if (restaurantRes.data?.id) {
          await supabase.from("payment_logs").insert([{
            restaurant_id:       restaurantRes.data.id,
            razorpay_payment_id: event.payload?.payment?.entity?.id,
            razorpay_event:      eventType,
            amount:              (event.payload?.payment?.entity?.amount || 0) / 100,
            status:              "failed",
          }]);
        }
      }
    }

    if (eventType === "subscription.cancelled") {
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

    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Webhook error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
