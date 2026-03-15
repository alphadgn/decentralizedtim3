/**
 * Privy JWT verification with JWKS signature validation.
 * 
 * SECURITY: This verifies the JWT signature against Privy's public keys,
 * not just the payload structure. This prevents JWT forgery attacks.
 */

const PRIVY_APP_ID = "cmmo24bor00mx0ci8zsdmpsq8";
const PRIVY_JWKS_URL = `https://auth.privy.io/api/v1/apps/${PRIVY_APP_ID}/.well-known/jwks.json`;

// Cache JWKS keys for 1 hour
let cachedKeys: { keys: JsonWebKey[]; fetchedAt: number } | null = null;
const CACHE_TTL_MS = 3600_000;

interface JWTPayload {
  sub: string;
  iss: string;
  aud: string;
  exp: number;
  iat: number;
  [key: string]: unknown;
}

function base64UrlDecode(str: string): Uint8Array {
  const base64 = str.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
  const binary = atob(padded);
  return Uint8Array.from(binary, (c) => c.charCodeAt(0));
}

async function fetchJWKS(): Promise<JsonWebKey[]> {
  if (cachedKeys && Date.now() - cachedKeys.fetchedAt < CACHE_TTL_MS) {
    return cachedKeys.keys;
  }

  try {
    const resp = await fetch(PRIVY_JWKS_URL);
    if (!resp.ok) throw new Error(`JWKS fetch failed: ${resp.status}`);
    const data = await resp.json();
    cachedKeys = { keys: data.keys, fetchedAt: Date.now() };
    return data.keys;
  } catch (e) {
    console.error("JWKS fetch error:", e);
    // If we have stale cache, use it as fallback
    if (cachedKeys) return cachedKeys.keys;
    throw e;
  }
}

function findKey(keys: JsonWebKey[], kid: string): JsonWebKey | undefined {
  return keys.find((k: any) => k.kid === kid);
}

/**
 * Verifies a Privy JWT and returns the payload if valid.
 * Returns null if verification fails.
 */
export async function verifyPrivyJWT(token: string): Promise<JWTPayload | null> {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;

    // Decode header to get kid
    const header = JSON.parse(new TextDecoder().decode(base64UrlDecode(parts[0])));
    if (!header.kid || header.alg !== "ES256") return null;

    // Fetch JWKS and find the key
    const keys = await fetchJWKS();
    const jwk = findKey(keys, header.kid);
    if (!jwk) return null;

    // Import the public key
    const cryptoKey = await crypto.subtle.importKey(
      "jwk",
      jwk,
      { name: "ECDSA", namedCurve: "P-256" },
      false,
      ["verify"]
    );

    // Verify the signature
    const signedData = new TextEncoder().encode(`${parts[0]}.${parts[1]}`);
    const signature = base64UrlDecode(parts[2]);

    // Convert from JWS compact format to DER if needed (ES256 uses raw r||s format)
    const valid = await crypto.subtle.verify(
      { name: "ECDSA", hash: "SHA-256" },
      cryptoKey,
      signature,
      signedData
    );

    if (!valid) return null;

    // Parse and validate payload
    const payload: JWTPayload = JSON.parse(new TextDecoder().decode(base64UrlDecode(parts[1])));

    // Check expiration (with 30s clock skew tolerance)
    if (payload.exp && payload.exp < (Date.now() / 1000) - 30) return null;

    // Check issuer
    if (!payload.iss?.includes("privy.io")) return null;

    // Check audience matches our app
    if (payload.aud && payload.aud !== PRIVY_APP_ID) return null;

    return payload;
  } catch (e) {
    console.error("JWT verification error:", e);
    return null;
  }
}

/**
 * Lightweight fallback: only checks structure, issuer, expiry.
 * USE ONLY when JWKS is unavailable and you need graceful degradation.
 */
export function verifyPrivyTokenLightweight(token: string): { valid: boolean; sub: string | null } {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return { valid: false, sub: null };

    const payload = JSON.parse(new TextDecoder().decode(base64UrlDecode(parts[1])));

    if (payload.exp && payload.exp < Date.now() / 1000) return { valid: false, sub: null };
    if (!payload.iss?.includes("privy.io")) return { valid: false, sub: null };

    return { valid: true, sub: payload.sub || null };
  } catch {
    return { valid: false, sub: null };
  }
}

/**
 * Extract Bearer token from Authorization header
 */
export function extractBearerToken(req: Request): string | null {
  const authHeader = req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;
  return authHeader.slice(7);
}

/**
 * Deterministic UUID from email using SHA-256
 */
export async function emailToUuid(email: string): Promise<string> {
  const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(email));
  const hex = Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    "4" + hex.slice(13, 16),
    "8" + hex.slice(17, 20),
    hex.slice(20, 32),
  ].join("-");
}

/**
 * Cryptographic SHA-256 hash
 */
export async function sha256(data: string): Promise<string> {
  const hashBuffer = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(data));
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
