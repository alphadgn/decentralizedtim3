import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { verifyPrivyJWT, verifyPrivyTokenLightweight, extractBearerToken, emailToUuid } from "../_shared/verify-privy-jwt.ts";
import { getCorsHeaders } from "../_shared/cors.ts";

// Stripe price IDs — to be configured when Stripe is connected
const PRICE_IDS: Record<string, string> = {
  free: "", // no checkout needed
  pro: Deno.env.get("STRIPE_PRO_PRICE_ID") ?? "",
  enterprise: Deno.env.get("STRIPE_ENTERPRISE_PRICE_ID") ?? "",
};

const ALLOWED_TIERS = ["pro", "enterprise"];

async function authenticateRequest(req: Request): Promise<{ authenticated: boolean; privySub: string | null }> {
  const token = extractBearerToken(req);
  if (!token) return { authenticated: false, privySub: null };

  const payload = await verifyPrivyJWT(token);
  if (payload) return { authenticated: true, privySub: payload.sub };

  const lightweight = verifyPrivyTokenLightweight(token);
  return { authenticated: lightweight.valid, privySub: lightweight.sub };
}

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    // --- Authentication: require valid Privy JWT ---
    const { authenticated } = await authenticateRequest(req);
    if (!authenticated) {
      return new Response(JSON.stringify({ error: "Unauthorized — valid Privy token required" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) {
      return new Response(JSON.stringify({
        error: "Billing system is being configured. Please try again later.",
        code: "STRIPE_NOT_CONFIGURED",
      }), {
        status: 503,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { tier, email, returnUrl } = await req.json();

    // Validate tier
    if (!tier || !ALLOWED_TIERS.includes(tier)) {
      return new Response(JSON.stringify({ error: "Invalid or missing tier" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Validate email
    if (!email || typeof email !== "string" || !email.includes("@") || email.length > 255) {
      return new Response(JSON.stringify({ error: "Valid email is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Derive userId server-side from email — never trust client-supplied userId
    const userId = await emailToUuid(email.toLowerCase());

    const priceId = PRICE_IDS[tier];
    if (!priceId) {
      return new Response(JSON.stringify({
        error: "Pricing not yet configured for this tier",
        code: "PRICE_NOT_CONFIGURED",
      }), {
        status: 503,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Check for existing Stripe customer
    const { data: existingSub } = await supabase
      .from("user_subscriptions")
      .select("stripe_customer_id")
      .eq("user_id", userId)
      .maybeSingle();

    // Create or reuse Stripe customer
    let customerId = existingSub?.stripe_customer_id;

    if (!customerId) {
      const customerRes = await fetch("https://api.stripe.com/v1/customers", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${stripeKey}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({ email, "metadata[user_id]": userId }),
      });
      const customer = await customerRes.json();
      if (customer.error) {
        console.error("Stripe customer error:", customer.error);
        return new Response(JSON.stringify({ error: "Failed to create customer" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      customerId = customer.id;

      // Store customer ID
      await supabase.from("user_subscriptions").upsert({
        user_id: userId,
        stripe_customer_id: customerId,
        tier: "free",
        status: "active",
      }, { onConflict: "user_id" });
    }

    // Create Checkout Session — only allow known origins
    const allowedOrigins = ["https://defitime.io", "https://decentralizedtim3.lovable.app"];
    const requestOrigin = req.headers.get("origin") || "";
    const origin = allowedOrigins.includes(requestOrigin) ? requestOrigin : allowedOrigins[0];
    // Ignore client-supplied returnUrl to prevent open redirect

    const sessionRes = await fetch("https://api.stripe.com/v1/checkout/sessions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${stripeKey}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        customer: customerId!,
        mode: "subscription",
        "line_items[0][price]": priceId,
        "line_items[0][quantity]": "1",
        success_url: `${origin}/dashboard?checkout=success`,
        cancel_url: `${origin}/pricing?checkout=cancelled`,
        "metadata[user_id]": userId,
        "metadata[tier]": tier,
      }),
    });

    const session = await sessionRes.json();
    if (session.error) {
      console.error("Stripe session error:", session.error);
      return new Response(JSON.stringify({ error: "Failed to create checkout session" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ url: session.url, sessionId: session.id }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("create-checkout error:", e);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
