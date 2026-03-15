import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { verifyPrivyJWT, verifyPrivyTokenLightweight, extractBearerToken, emailToUuid } from "../_shared/verify-privy-jwt.ts";
import { getCorsHeaders } from "../_shared/cors.ts";

const SUPER_ADMIN_EMAIL = "a1cust0msenterprises@gmail.com";
const CUSTOMER_SERVICE_EMAIL = "decentralizedtim3@gmail.com";

async function authenticateRequest(req: Request): Promise<{ authenticated: boolean; privySub: string | null }> {
  const token = extractBearerToken(req);
  if (!token) return { authenticated: false, privySub: null };

  // Try full JWKS verification first
  const payload = await verifyPrivyJWT(token);
  if (payload) return { authenticated: true, privySub: payload.sub };

  // Fallback to lightweight check if JWKS unavailable
  const lightweight = verifyPrivyTokenLightweight(token);
  return { authenticated: lightweight.valid, privySub: lightweight.sub };
}

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email, userId, action } = await req.json();

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Verify the caller has a valid Privy token
    const { authenticated } = await authenticateRequest(req);

    // Action: check if email is approved
    if (action === "check_approval") {
      if (!email || typeof email !== "string" || email.length > 255) {
        return new Response(JSON.stringify({ error: "Invalid email" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (!authenticated) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Super admin is always approved and exempt from all penalties
      if (email.toLowerCase() === SUPER_ADMIN_EMAIL) {
        return new Response(JSON.stringify({ approved: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: approved } = await supabase
        .from("approved_emails")
        .select("id")
        .eq("email", email.toLowerCase())
        .maybeSingle();

      if (!approved) {
        const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
          req.headers.get("cf-connecting-ip") || "unknown";

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

    // Action: sync user
    if (!email || !userId || typeof email !== "string" || typeof userId !== "string") {
      return new Response(JSON.stringify({ error: "Missing email or userId" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!authenticated) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // SECURITY: Verify userId matches the email-derived UUID to prevent spoofing
    const expectedUserId = await emailToUuid(email.toLowerCase());
    if (userId !== expectedUserId) {
      return new Response(JSON.stringify({ error: "userId mismatch" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Super admin is exempt from approval check
    const isSuperAdminEmail = email.toLowerCase() === SUPER_ADMIN_EMAIL;

    if (!isSuperAdminEmail) {
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
    }

    const isCustomerServiceEmail = email.toLowerCase() === CUSTOMER_SERVICE_EMAIL;
    const correctRole = isSuperAdminEmail ? "super_admin" : (isCustomerServiceEmail ? "support" : "user");

    // Check if profile already exists
    const { data: existing } = await supabase
      .from("profiles")
      .select("user_id")
      .eq("user_id", userId)
      .maybeSingle();

    if (!existing) {
      await supabase.from("profiles").insert({
        user_id: userId,
        display_name: isSuperAdminEmail ? "Admin" : "User",
      });

      await supabase.from("user_roles").insert({
        user_id: userId,
        role: correctRole,
      });
    } else {
      // ALWAYS enforce correct role for super admin email on every sync
      if (isSuperAdminEmail) {
        const { data: roleData } = await supabase
          .from("user_roles")
          .select("id, role")
          .eq("user_id", userId)
          .maybeSingle();

        if (roleData && roleData.role !== "super_admin") {
          await supabase
            .from("user_roles")
            .update({ role: "super_admin" })
            .eq("id", roleData.id);
        } else if (!roleData) {
          await supabase.from("user_roles").insert({
            user_id: userId,
            role: "super_admin",
          });
        }
      }
    }

    // Fetch and return the user's current role
    const { data: finalRole } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .maybeSingle();

    return new Response(JSON.stringify({ ok: true, role: finalRole?.role ?? "user" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("sync-privy-user error:", e);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
