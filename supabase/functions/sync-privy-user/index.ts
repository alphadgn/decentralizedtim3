import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { verifyPrivyJWT, verifyPrivyTokenLightweight, extractBearerToken, emailToUuid } from "../_shared/verify-privy-jwt.ts";
import { getCorsHeaders } from "../_shared/cors.ts";

const SUPER_ADMIN_EMAIL = "a1cust0msenterprises@gmail.com";
const SUPER_ADMIN_PRIVY_SUB = "a7069b27-a45c-4712-8a06-6c87a29bcfbf";
const CUSTOMER_SERVICE_EMAIL = "decentralizedtim3@gmail.com";

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const [, payload] = token.split(".");
    if (!payload) return null;
    const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
    return JSON.parse(atob(padded));
  } catch {
    return null;
  }
}

function extractEmailFromPayload(payload: Record<string, unknown> | null): string | null {
  if (!payload) return null;

  const directCandidates = [
    (payload as any)?.email,
    (payload as any)?.email_address,
    (payload as any)?.user?.email?.address,
    (payload as any)?.user?.email,
  ];

  for (const candidate of directCandidates) {
    if (typeof candidate === "string" && candidate.includes("@")) return candidate.toLowerCase();
  }

  const linked = (payload as any)?.linked_accounts;
  if (Array.isArray(linked)) {
    for (const account of linked) {
      const accountEmail = account?.address ?? account?.email ?? account?.email_address;
      if (typeof accountEmail === "string" && accountEmail.includes("@")) {
        return accountEmail.toLowerCase();
      }
    }
  }

  return null;
}

async function authenticateRequest(req: Request): Promise<{
  authenticated: boolean;
  privySub: string | null;
  tokenEmail: string | null;
}> {
  const token = extractBearerToken(req);
  if (!token) return { authenticated: false, privySub: null, tokenEmail: null };

  // Try full JWKS verification first
  const payload = await verifyPrivyJWT(token);
  if (payload) {
    return {
      authenticated: true,
      privySub: payload.sub ?? null,
      tokenEmail: extractEmailFromPayload(payload as unknown as Record<string, unknown>),
    };
  }

  // Fallback to lightweight check if JWKS unavailable
  const lightweight = verifyPrivyTokenLightweight(token);
  const decoded = decodeJwtPayload(token);
  return {
    authenticated: lightweight.valid,
    privySub: lightweight.sub,
    tokenEmail: extractEmailFromPayload(decoded),
  };
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

    const { authenticated, privySub, tokenEmail } = await authenticateRequest(req);

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

      const normalizedEmail = email.toLowerCase();
      const isSuperAdminIdentity =
        normalizedEmail === SUPER_ADMIN_EMAIL ||
        tokenEmail === SUPER_ADMIN_EMAIL ||
        privySub === SUPER_ADMIN_PRIVY_SUB;

      if (tokenEmail && tokenEmail !== normalizedEmail && !isSuperAdminIdentity) {
        return new Response(JSON.stringify({ error: "Email identity mismatch" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Founder path is always approved and never blocked
      if (isSuperAdminIdentity) {
        await supabase.from("blocked_users").delete().eq("email", SUPER_ADMIN_EMAIL);

        return new Response(JSON.stringify({ approved: true, blocked: false, attempts: 0 }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: approved } = await supabase
        .from("approved_emails")
        .select("id")
        .eq("email", normalizedEmail)
        .maybeSingle();

      if (!approved) {
        const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
          req.headers.get("cf-connecting-ip") || "unknown";

        const { data: existing } = await supabase
          .from("blocked_users")
          .select("id, attempt_count")
          .eq("email", normalizedEmail)
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
        }

        await supabase
          .from("blocked_users")
          .insert({ email: normalizedEmail, ip_address: ip, attempt_count: 1 });

        return new Response(JSON.stringify({ approved: false, attempts: 1, blocked: false }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ approved: true, blocked: false, attempts: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

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

    const requestedEmail = email.toLowerCase();
    const isSuperAdminIdentity =
      requestedEmail === SUPER_ADMIN_EMAIL ||
      tokenEmail === SUPER_ADMIN_EMAIL ||
      privySub === SUPER_ADMIN_PRIVY_SUB;

    const canonicalEmail = isSuperAdminIdentity ? SUPER_ADMIN_EMAIL : requestedEmail;

    if (tokenEmail && tokenEmail !== canonicalEmail && !isSuperAdminIdentity) {
      return new Response(JSON.stringify({ error: "Email identity mismatch" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const expectedUserId = await emailToUuid(canonicalEmail);
    if (userId !== expectedUserId) {
      return new Response(JSON.stringify({ error: "userId mismatch" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!isSuperAdminIdentity) {
      const { data: approvedCheck } = await supabase
        .from("approved_emails")
        .select("id")
        .eq("email", canonicalEmail)
        .maybeSingle();

      if (!approvedCheck) {
        return new Response(JSON.stringify({ error: "Email not approved" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const isCustomerServiceEmail = canonicalEmail === CUSTOMER_SERVICE_EMAIL;
    const correctRole = isSuperAdminIdentity ? "super_admin" : (isCustomerServiceEmail ? "support" : "user");

    const { data: existing } = await supabase
      .from("profiles")
      .select("user_id")
      .eq("user_id", userId)
      .maybeSingle();

    if (!existing) {
      await supabase.from("profiles").insert({
        user_id: userId,
        display_name: isSuperAdminIdentity ? "Founder" : "User",
      });

      await supabase.from("user_roles").insert({
        user_id: userId,
        role: correctRole,
      });
    } else if (isSuperAdminIdentity) {
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

    const { data: finalRole } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .maybeSingle();

    return new Response(JSON.stringify({ ok: true, role: finalRole?.role ?? correctRole }), {
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