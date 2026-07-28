/**
 * Privileged-route authorisation.
 *
 * SECURITY: every step here is signature-verified. The previous implementation
 * accepted, in order of decreasing safety:
 *   1. a JWKS-verified Privy token,
 *   2. an *unverified* base64 decode of the same token, and
 *   3. a bare `x-user-id` request header.
 *
 * Steps 2 and 3 meant anyone could mint `{"sub": "<super-admin-uuid>"}`, or
 * simply set a header, and obtain super-admin access — the admin UUID is a
 * literal in the repository. Both fallbacks are gone. Identity is now:
 *
 *   verified JWT -> privy_identities.privy_sub -> user_id -> user_roles
 *
 * with the role read from the database rather than compared against a
 * hardcoded email address.
 */

import { extractBearerToken, verifyPrivyJWT, emailToUuid } from "./verify-privy-jwt.ts";

export type AppRole = "super_admin" | "admin" | "auditor" | "support" | "user";

export interface AdminIdentity {
  userId: string;
  privySub: string;
}

function extractVerifiedEmail(payload: Record<string, unknown> | null): string | null {
  if (!payload) return null;

  if (typeof payload.email === "string") return payload.email;

  const user = payload.user as { email?: { address?: string } } | undefined;
  if (typeof user?.email?.address === "string") return user.email.address;

  const linked = payload.linked_accounts;
  if (Array.isArray(linked)) {
    const emailAccount = linked.find((account: Record<string, unknown>) => {
      const type = account?.type ?? account?.account_type;
      return type === "email";
    });
    if (typeof emailAccount?.address === "string") return emailAccount.address;
    if (typeof emailAccount?.email === "string") return emailAccount.email;
  }

  return null;
}

/**
 * Resolves the caller to an application user id, or null if the token is
 * absent, unverifiable, or not linked to a known account.
 */
export async function resolveAuthenticatedUser(
  supabase: any,
  req: Request,
): Promise<AdminIdentity | null> {
  const token = extractBearerToken(req);
  if (!token) return null;

  // Full JWKS signature verification. No lightweight or decode-only fallback:
  // if Privy's JWKS endpoint is unreachable we fail closed on admin routes.
  const payload = await verifyPrivyJWT(token);
  if (!payload?.sub) return null;

  const privySub = payload.sub;

  const { data: mapping } = await supabase
    .from("privy_identities")
    .select("user_id")
    .eq("privy_sub", privySub)
    .maybeSingle();

  if (mapping?.user_id) {
    return { userId: mapping.user_id, privySub };
  }

  // Fall back to the email claim when present — still taken from the verified
  // payload, and mapped through the same derivation sync-privy-user uses.
  const email = extractVerifiedEmail(payload as Record<string, unknown>);
  if (email) {
    return { userId: await emailToUuid(email.toLowerCase()), privySub };
  }

  return null;
}

export async function hasRole(
  supabase: any,
  userId: string,
  role: AppRole,
): Promise<boolean> {
  const { data, error } = await supabase.rpc("has_role", {
    _user_id: userId,
    _role: role,
  });

  if (error) {
    console.error("has_role check failed:", error);
    return false;
  }
  return data === true;
}

/** True only for a verified session whose user carries the super_admin role. */
export async function requireSuperAdmin(
  supabase: any,
  req: Request,
): Promise<AdminIdentity | null> {
  const identity = await resolveAuthenticatedUser(supabase, req);
  if (!identity) return null;

  const ok = await hasRole(supabase, identity.userId, "super_admin");
  return ok ? identity : null;
}
