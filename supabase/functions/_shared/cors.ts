/**
 * CORS configuration for Edge Functions.
 *
 * Two distinct policies, because these endpoints have two distinct threat
 * models:
 *
 *   getCorsHeaders()       — credentialed, first-party surfaces (dashboard,
 *                            profile, admin). Locked to an origin allowlist
 *                            because these requests carry a user session.
 *
 *   getPublicCorsHeaders() — the public developer API. Open to any origin:
 *                            authentication is a bearer API key that the
 *                            browser never attaches automatically, so there is
 *                            no ambient authority for a hostile page to abuse.
 *                            Credentials are explicitly NOT allowed, which is
 *                            what keeps `*` safe here.
 */

const ALLOWED_ORIGINS = [
  "https://defitime.io",
  "http://defitime.io",
  "https://decentralizedtim3.lovable.app",
  "https://id-preview--604fe7d4-ffda-4369-8729-382130c9bc18.lovable.app",
  "https://604fe7d4-ffda-4369-8729-382130c9bc18.lovableproject.com",
];

const REQUEST_HEADERS = [
  "authorization",
  "x-api-key",
  "x-client-info",
  "apikey",
  "content-type",
  "x-signature",
  "x-timestamp",
  "x-nonce",
  "x-request-signature",
  "x-user-id",
  "x-supabase-client-platform",
  "x-supabase-client-platform-version",
  "x-supabase-client-runtime",
  "x-supabase-client-runtime-version",
].join(", ");

/** Headers a browser client must be able to read off the response. */
const EXPOSED_HEADERS = [
  "X-Request-Id",
  "X-RateLimit-Limit",
  "X-RateLimit-Remaining",
  "X-RateLimit-Reset",
  "X-RateLimit-Tier",
  "RateLimit-Limit",
  "RateLimit-Remaining",
  "RateLimit-Reset",
  "RateLimit-Policy",
  "Retry-After",
  "Deprecation",
  "Sunset",
  "Link",
].join(", ");

export function getCorsHeaders(req?: Request): Record<string, string> {
  const origin = req?.headers.get("origin") ?? "";
  const allowedOrigin = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];

  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Headers": REQUEST_HEADERS,
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Expose-Headers": EXPOSED_HEADERS,
    "Vary": "Origin",
  };
}

export function getPublicCorsHeaders(): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": REQUEST_HEADERS,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Expose-Headers": EXPOSED_HEADERS,
    "Access-Control-Max-Age": "86400",
  };
}

export function isAllowedOrigin(origin: string): boolean {
  return ALLOWED_ORIGINS.includes(origin);
}
