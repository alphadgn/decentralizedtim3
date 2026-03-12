import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SUPER_ADMIN_EMAIL = "a1cust0msenterprises@gmail.com";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email, userId, action } = await req.json();

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Action: check if email is approved (no userId needed)
    if (action === "check_approval") {
      if (!email) {
        return new Response(JSON.stringify({ error: "Missing email" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: approved } = await supabase
        .from("approved_emails")
        .select("id")
        .eq("email", email.toLowerCase())
        .maybeSingle();

      if (!approved) {
        // Get IP from request headers
        const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
          req.headers.get("cf-connecting-ip") || "unknown";

        // Check if already blocked
        const { data: existing } = await supabase
          .from("blocked_users")
          .select("id, attempt_count")
          .eq("email", email.toLowerCase())
          .maybeSingle();

        if (existing) {
          await supabase
            .from("blocked_users")
            .update({ attempt_count: existing.attempt_count + 1, ip_address: ip })
            .eq("id", existing.id);

          return new Response(JSON.stringify({
            approved: false,
            attempts: existing.attempt_count + 1,
            blocked: existing.attempt_count + 1 >= 2,
          }), {
            status: 403,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        } else {
          await supabase
            .from("blocked_users")
            .insert({ email: email.toLowerCase(), ip_address: ip, attempt_count: 1 });

          return new Response(JSON.stringify({
            approved: false,
            attempts: 1,
            blocked: false,
          }), {
            status: 403,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      }

      return new Response(JSON.stringify({ approved: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Action: sync user (existing logic)
    if (!email || !userId) {
      return new Response(JSON.stringify({ error: "Missing email or userId" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Double-check approval before syncing
    const { data: approvedCheck } = await supabase
      .from("approved_emails")
      .select("id")
      .eq("email", email.toLowerCase())
      .maybeSingle();

    if (!approvedCheck) {
      return new Response(JSON.stringify({ error: "Email not approved" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check if profile already exists
    const { data: existing } = await supabase
      .from("profiles")
      .select("user_id")
      .eq("user_id", userId)
      .maybeSingle();

    if (!existing) {
      // Create profile
      await supabase.from("profiles").insert({
        user_id: userId,
        display_name: email,
      });

      // Assign role
      const role = email.toLowerCase() === SUPER_ADMIN_EMAIL ? "super_admin" : "user";
      await supabase.from("user_roles").insert({
        user_id: userId,
        role,
      });
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
