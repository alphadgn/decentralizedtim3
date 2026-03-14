import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SUPER_ADMIN_EMAIL = "a1cust0msenterprises@gmail.com";

// Verify Privy JWT is present and not expired
function verifyPrivyToken(req: Request): boolean {
  const authHeader = req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) return false;

  const token = authHeader.replace("Bearer ", "");

  try {
    const parts = token.split(".");
    if (parts.length !== 3) return false;

    const payload = JSON.parse(atob(parts[1].replace(/-/g, "+").replace(/_/g, "/")));

    // Check expiration
    if (payload.exp && payload.exp < Date.now() / 1000) return false;

    // Check issuer is Privy
    if (!payload.iss?.includes("privy.io")) return false;

    return true;
  } catch {
    return false;
  }
}

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

    // Verify the caller has a valid Privy token
    const hasValidToken = verifyPrivyToken(req);

    // Action: check if email is approved
    if (action === "check_approval") {
      if (!email || typeof email !== "string" || email.length > 255) {
        return new Response(JSON.stringify({ error: "Invalid email" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Require valid Privy token
      if (!hasValidToken) {
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

    // Require valid Privy token
    if (!hasValidToken) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Super admin is exempt from approval check
    const isSuperAdminEmail = email.toLowerCase() === SUPER_ADMIN_EMAIL;

    if (!isSuperAdminEmail) {
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
    }

    // Determine correct role
    const correctRole = isSuperAdminEmail ? "super_admin" : "user";

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
        display_name: isSuperAdminEmail ? "Admin" : "User",
      });

      // Create role
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

    return new Response(JSON.stringify({ ok: true }), {
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
