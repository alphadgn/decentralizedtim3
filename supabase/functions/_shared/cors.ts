/**
 * Shared CORS configuration for all Edge Functions.
 * Allows production, preview, and dev domains.
 */

const ALLOWED_ORIGINS = [
  "https://defitime.io",
  "http://defitime.io",
  "https://decentralizedtim3.lovable.app",
  "https://id-preview--604fe7d4-ffda-4369-8729-382130c9bc18.lovable.app",
  "https://604fe7d4-ffda-4369-8729-382130c9bc18.lovableproject.com",
];

export function getCorsHeaders(req?: Request): Record<string, string> {
  const origin = req?.headers.get("origin") ?? "";
  const allowedOrigin = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];

  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type, x-request-signature, x-timestamp, x-user-id, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Vary": "Origin",
  };
}
