// =====================================================
// SUPABASE EDGE FUNCTION: razorpay-webhook
// =====================================================
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const RAZORPAY_WEBHOOK_SECRET = Deno.env.get("RAZORPAY_WEBHOOK_SECRET") ?? "";
const SUPABASE_URL            = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_KEY    = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? Deno.env.get("SERVICE_ROLE_KEY") ?? "";

async function verifySignature(body: string, signature: string, secret: string): Promise<boolean> {
  if (!secret) {
    console.error("[Webhook] Verification Error: RAZORPAY_WEBHOOK_SECRET is not set in environment.");
    return false;
  }
  
  const encoder = new TextEncoder();
  const keyData = encoder.encode(secret);
  const key = await crypto.subtle.importKey(
    'raw', 
    keyData, 
    { name: 'HMAC', hash: 'SHA-256' }, 
    false, 
    ['sign']
  );
  const bodyData = encoder.encode(body);
  const signatureData = await crypto.subtle.sign('HMAC', key, bodyData);
  const generatedSignature = Array.from(new Uint8Array(signatureData))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
    
  if (generatedSignature !== signature) {
    console.error("[Webhook] Signature mismatch!");
    console.error("  Generated:", generatedSignature);
    console.error("  Received: ", signature);
    return false;
  }
  return true;
}

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  try {
    const body      = await req.text();
    const signature = req.headers.get("x-razorpay-signature") ?? "";

    console.log(`[Webhook] Incoming request. Signature present: ${!!signature}`);

    // Signature verification
    if (!await verifySignature(body, signature, RAZORPAY_WEBHOOK_SECRET)) {
      return new Response(JSON.stringify({ error: "Invalid signature" }), { status: 401 });
    }

    const event = JSON.parse(body);
    const eventType = event.event;
    console.log(`[Webhook] Event: ${eventType}, ID: ${event.id}`);

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    // Extract ID and Plan from payload
    const subscription = event.payload?.subscription?.entity;
    const payment = event.payload?.payment?.entity;
    
    const subscriptionId = subscription?.id || payment?.subscription_id;
    // Notes can be in subscription or payment (via checkout)
    const restaurantId = subscription?.notes?.restaurant_id || payment?.notes?.restaurant_id || event.payload?.subscription?.notes?.restaurant_id;

    console.log(`[Webhook] Extraction - SubID: ${subscriptionId}, RestID: ${restaurantId}`);

    if (eventType === "subscription.authenticated" || eventType === "subscription.activated") {
      if (subscriptionId) {
        console.log(`[Webhook] Activating subscription ${subscriptionId}...`);
        const nextDate = new Date();
        nextDate.setMonth(nextDate.getMonth() + 1);

        const updates: any = {
          subscription_status: "active",
          autopay_enabled:     true,
          next_payment_date:   nextDate.toISOString()
        };
        
        // Use plan from notes if available
        const plan = subscription?.notes?.plan || event.payload?.subscription?.notes?.plan;
        if (plan) updates.plan = plan;

        const { error } = await supabase
          .from("restaurants")
          .update(updates)
          .eq("razorpay_subscription_id", subscriptionId);
          
        if (error) {
          console.error("[Webhook] DB Update Error (Activation):", error);
          throw error;
        }
        console.log(`[Webhook] Success: Activated subscription ${subscriptionId}`);
      }
    }

    if (eventType === "subscription.charged") {
      if (subscriptionId) {
        console.log(`[Webhook] Charging subscription ${subscriptionId}...`);
        const nextDate = new Date();
        nextDate.setMonth(nextDate.getMonth() + 1);

        const { error } = await supabase
          .from("restaurants")
          .update({
            subscription_status: "active",
            next_payment_date:   nextDate.toISOString(),
          })
          .eq("razorpay_subscription_id", subscriptionId);
          
        if (error) console.error("[Webhook] DB Update Error (Charge):", error);

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
        console.log(`[Webhook] Subscription ${subscriptionId} status changed to: ${eventType}`);
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
       console.log(`[Webhook] Payment failed for SubID: ${subscriptionId}`);
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
    console.error("[Webhook] Fatal Error:", err.message);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
