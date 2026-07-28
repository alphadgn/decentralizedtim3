/**
 * API key authentication, scoping and optional request signing.
 */

import { sha256 } from "./verify-privy-jwt.ts";

export type Tier = "anonymous" | "free" | "pro" | "enterprise";

export const API_KEY_PREFIX = "dgtn_live_";

/** Scope grants, narrowest first. */
export type Scope =
  | "time:read"
  | "anchors:read"
  | "analytics:read"
  | "risk:read"
  | "gmc:read"
  | "gmc:write"
  | "orders:write";

const READ_SCOPES: Scope[] = ["time:read", "anchors:read", "analytics:read", "risk:read"];

/**
 * What each tier may hold. A key's explicit `scopes` column can narrow this
 * (least privilege for keys embedded in clients) but never widen it.
 */
export const TIER_SCOPES: Record<Tier, Scope[]> = {
  anonymous:  ["time:read", "anchors:read"],
  free:       READ_SCOPES,
  pro:        READ_SCOPES,
  enterprise: [...READ_SCOPES, "gmc:read", "gmc:write", "orders:write"],
};

export const TIER_RANK: Record<Tier, number> = {
  anonymous: 0,
  free: 1,
  pro: 2,
  enterprise: 3,
};

export type AuthFailure =
  | "invalid_key"
  | "revoked"
  | "expired"
  | "quota_exceeded";

export interface Caller {
  tier: Tier;
  keyId: string | null;
  userId: string | null;
  /** Effective scopes after intersecting the key's grants with its tier. */
  scopes: Scope[];
  requiresSignature: boolean;
  /** Stable bucket identity: the key where present, otherwise the client IP. */
  identity: string;
  /** Set when a key was presented but could not be used. */
  failure: AuthFailure | null;
  quota: { used: number; limit: number; resetAt: string | null } | null;
}

export function getClientIp(req: Request): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("cf-connecting-ip") ||
    "unknown"
  );
}

/**
 * Pulls the presented API key out of the request.
 *
 * Accepts `Authorization: Bearer <key>` (the documented form) and `X-API-Key`
 * (convenient for tools that reserve the Authorization header). A Privy
 * session JWT may legitimately arrive in the Authorization header from our own
 * dashboard, so anything that is not shaped like an API key is ignored here
 * rather than reported as an invalid key.
 */
export function extractApiKey(req: Request): string | null {
  const explicit = req.headers.get("x-api-key")?.trim();
  if (explicit) return explicit;

  const auth = req.headers.get("authorization") ?? "";
  const bearer = auth.replace(/^Bearer\s+/i, "").trim();
  if (!bearer) return null;

  return bearer.startsWith(API_KEY_PREFIX) ? bearer : null;
}

const anonymousCaller = (ip: string): Caller => ({
  tier: "anonymous",
  keyId: null,
  userId: null,
  scopes: TIER_SCOPES.anonymous,
  requiresSignature: false,
  identity: `ip:${ip}`,
  failure: null,
  quota: null,
});

export async function resolveCaller(
  supabase: any,
  req: Request,
  ip: string,
): Promise<Caller> {
  const presentedKey = extractApiKey(req);
  if (!presentedKey) return anonymousCaller(ip);

  const keyHash = await sha256(presentedKey);

  const { data, error } = await supabase.rpc("authenticate_api_key", {
    _key_hash: keyHash,
  });

  if (error) {
    console.error("authenticate_api_key failed:", error);
    return { ...anonymousCaller(ip), failure: "invalid_key" };
  }

  const row = Array.isArray(data) ? data[0] : data;
  if (!row || row.auth_status === "invalid_key") {
    return { ...anonymousCaller(ip), failure: "invalid_key" };
  }

  const tier = (row.tier ?? "free") as Tier;
  const tierScopes = TIER_SCOPES[tier] ?? TIER_SCOPES.free;

  // NULL scopes = everything the tier allows, so pre-scoping keys keep working.
  const granted: Scope[] = Array.isArray(row.scopes) && row.scopes.length > 0
    ? tierScopes.filter((s) => row.scopes.includes(s))
    : tierScopes;

  const caller: Caller = {
    tier,
    keyId: row.key_id ?? null,
    userId: row.owner_id ?? null,
    scopes: granted,
    requiresSignature: row.requires_signature === true,
    identity: row.key_id ? `key:${row.key_id}` : `ip:${ip}`,
    failure: null,
    quota: {
      used: row.requests_month ?? 0,
      limit: row.quota_limit ?? -1,
      resetAt: row.quota_reset_at ?? null,
    },
  };

  switch (row.auth_status) {
    case "active":
      return caller;
    case "revoked":
      return { ...caller, failure: "revoked" };
    case "expired":
      return { ...caller, failure: "expired" };
    case "quota_exceeded":
      return { ...caller, failure: "quota_exceeded" };
    default:
      return { ...anonymousCaller(ip), failure: "invalid_key" };
  }
}

export function hasScope(caller: Caller, required: Scope | null): boolean {
  if (!required) return true;
  return caller.scopes.includes(required);
}

export function meetsTier(caller: Caller, required: Tier): boolean {
  return TIER_RANK[caller.tier] >= TIER_RANK[required];
}

// ── Request signing (opt-in, per key) ──────────────────────────────────────

export type SignatureResult =
  | { ok: true }
  | { ok: false; reason: "missing" | "malformed" | "stale" | "mismatch" | "replay" };

const SIGNATURE_TOLERANCE_SECONDS = 300;
const NONCE_TTL_SECONDS = 600;

async function hmacHex(secret: string, message: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(message));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Length-independent comparison so a mismatch leaks no positional timing. */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

/**
 * Canonical string that gets signed.
 *
 * Unlike the previous scheme this covers the request body, so a POST payload
 * cannot be swapped under a captured signature, and it binds a single-use
 * nonce so a captured request cannot be replayed inside the clock-skew window.
 */
export function buildSigningString(
  method: string,
  path: string,
  timestamp: string,
  nonce: string,
  bodyHash: string,
): string {
  return ["v1", timestamp, nonce, method.toUpperCase(), path, bodyHash].join(":");
}

export async function verifySignature(
  supabase: any,
  req: Request,
  presentedKey: string,
  keyId: string | null,
  rawBody: string,
): Promise<SignatureResult> {
  const header = req.headers.get("x-signature");
  const timestamp = req.headers.get("x-timestamp");
  const nonce = req.headers.get("x-nonce");

  if (!header || !timestamp || !nonce) return { ok: false, reason: "missing" };

  const match = header.match(/^v1=([0-9a-f]{64})$/i);
  if (!match) return { ok: false, reason: "malformed" };

  const ts = Number.parseInt(timestamp, 10);
  if (!Number.isFinite(ts)) return { ok: false, reason: "malformed" };
  if (Math.abs(Date.now() / 1000 - ts) > SIGNATURE_TOLERANCE_SECONDS) {
    return { ok: false, reason: "stale" };
  }
  if (nonce.length < 8 || nonce.length > 128) return { ok: false, reason: "malformed" };

  const bodyHash = await sha256(rawBody ?? "");
  const url = new URL(req.url);
  const expected = await hmacHex(
    presentedKey,
    buildSigningString(req.method, normalizeSignedPath(url.pathname), timestamp, nonce, bodyHash),
  );

  if (!timingSafeEqual(expected, match[1].toLowerCase())) {
    return { ok: false, reason: "mismatch" };
  }

  // Only burn the nonce once the signature itself checks out, so a bad
  // signature cannot be used to invalidate a nonce the caller will reuse.
  const { data, error } = await supabase.rpc("claim_request_nonce", {
    _nonce_hash: await sha256(`${keyId ?? "anon"}:${nonce}`),
    _key_id: keyId,
    _ttl_seconds: NONCE_TTL_SECONDS,
  });

  if (error) {
    console.error("claim_request_nonce failed:", error);
    return { ok: false, reason: "replay" };
  }
  if (data !== true) return { ok: false, reason: "replay" };

  return { ok: true };
}

/**
 * Signatures are computed over the public path, so the platform's
 * `/functions/v1/api-gateway` mount point is stripped before signing and
 * before verification. A client signs what it sees in the docs.
 */
export function normalizeSignedPath(pathname: string): string {
  return pathname
    .replace(/^\/functions\/v1\/api-gateway/, "")
    .replace(/^\/api-gateway/, "") || "/";
}
