/**
 * Uniform error envelope for the public API.
 *
 * Every failure — auth, validation, rate limit, internal — comes back in the
 * same shape, with a stable machine-readable `code` that clients can branch on
 * without string-matching human prose:
 *
 *   {
 *     "error": {
 *       "type": "rate_limit_error",
 *       "code": "rate_limit_exceeded",
 *       "message": "Too many requests. Retry in 12 seconds.",
 *       "status": 429,
 *       "request_id": "req_9f2c1a...",
 *       "documentation_url": "https://.../docs#rate-limits"
 *     }
 *   }
 *
 * `request_id` is echoed on success responses too (X-Request-Id), so a
 * developer can quote one number in a support ticket.
 */

/**
 * Externally reachable base URL of the gateway, used for the OpenAPI `servers`
 * entry, the docs links and the `documentation_url` on every error. Derived from
 * SUPABASE_URL rather than the inbound request, whose host and path prefix
 * reflect internal routing. Set PUBLIC_API_BASE_URL once a custom domain (e.g.
 * https://api.defitime.io) is in front of the function.
 *
 * It lives here, next to the error envelope, because `apiError` needs it on
 * every call and threading it through ~20 call sites would buy nothing.
 */
export const PUBLIC_BASE_URL = (
  Deno.env.get("PUBLIC_API_BASE_URL") ??
  `${Deno.env.get("SUPABASE_URL") ?? ""}/functions/v1/api-gateway`
).replace(/\/+$/, "");

/**
 * The rendered API reference. Points at the reference this gateway itself
 * serves, so the link resolves wherever the function is deployed — the marketing
 * site has no /docs route, and a developer debugging a 401 should not be sent to
 * a 404 page.
 */
export const DOCS_BASE_URL = `${PUBLIC_BASE_URL}/docs`;

export type ApiErrorType =
  | "authentication_error"
  | "authorization_error"
  | "invalid_request_error"
  | "rate_limit_error"
  | "quota_error"
  | "not_found_error"
  | "api_error";

export type ApiErrorCode =
  // 400
  | "invalid_request"
  | "missing_parameter"
  | "invalid_parameter"
  | "unsupported_method"
  // 401
  | "missing_api_key"
  | "invalid_api_key"
  | "expired_api_key"
  | "revoked_api_key"
  | "invalid_signature"
  | "signature_required"
  | "signature_replay"
  // 403
  | "insufficient_tier"
  | "insufficient_scope"
  | "forbidden"
  // 404
  | "not_found"
  | "unknown_endpoint"
  // 402 / 429
  | "quota_exceeded"
  | "rate_limit_exceeded"
  // 5xx
  | "internal_error";

interface ErrorSpec {
  status: number;
  type: ApiErrorType;
  message: string;
  /** Docs anchor a developer should read to fix this themselves. */
  anchor: string;
}

const ERRORS: Record<ApiErrorCode, ErrorSpec> = {
  invalid_request:     { status: 400, type: "invalid_request_error", message: "The request was malformed.", anchor: "errors" },
  missing_parameter:   { status: 400, type: "invalid_request_error", message: "A required parameter is missing.", anchor: "errors" },
  invalid_parameter:   { status: 400, type: "invalid_request_error", message: "A parameter was invalid.", anchor: "errors" },
  unsupported_method:  { status: 405, type: "invalid_request_error", message: "That HTTP method is not supported on this endpoint.", anchor: "endpoints" },

  missing_api_key:     { status: 401, type: "authentication_error", message: "No API key was provided. Send it as 'Authorization: Bearer <key>'.", anchor: "authentication" },
  invalid_api_key:     { status: 401, type: "authentication_error", message: "The API key provided is not valid.", anchor: "authentication" },
  expired_api_key:     { status: 401, type: "authentication_error", message: "This API key has expired. Issue a new one from your dashboard.", anchor: "authentication" },
  revoked_api_key:     { status: 401, type: "authentication_error", message: "This API key has been revoked.", anchor: "authentication" },
  invalid_signature:   { status: 401, type: "authentication_error", message: "The request signature did not match.", anchor: "signed-requests" },
  signature_required:  { status: 401, type: "authentication_error", message: "This API key requires signed requests.", anchor: "signed-requests" },
  signature_replay:    { status: 401, type: "authentication_error", message: "This nonce has already been used.", anchor: "signed-requests" },

  insufficient_tier:   { status: 403, type: "authorization_error", message: "Your plan does not include this endpoint.", anchor: "plans" },
  insufficient_scope:  { status: 403, type: "authorization_error", message: "This API key is not scoped for this endpoint.", anchor: "scopes" },
  forbidden:           { status: 403, type: "authorization_error", message: "You do not have access to this resource.", anchor: "errors" },

  not_found:           { status: 404, type: "not_found_error", message: "The requested resource does not exist.", anchor: "errors" },
  unknown_endpoint:    { status: 404, type: "not_found_error", message: "Unknown endpoint. See the API reference for the supported routes.", anchor: "endpoints" },

  quota_exceeded:      { status: 402, type: "quota_error", message: "Your monthly request quota is exhausted.", anchor: "quotas" },
  rate_limit_exceeded: { status: 429, type: "rate_limit_error", message: "Too many requests.", anchor: "rate-limits" },

  internal_error:      { status: 500, type: "api_error", message: "Something went wrong on our side.", anchor: "errors" },
};

export interface ApiErrorOptions {
  /** Overrides the catalogue default when extra context helps the caller. */
  message?: string;
  /** Structured extras, e.g. { required_tier: "enterprise" }. */
  details?: Record<string, unknown>;
  /** Extra response headers (Retry-After, rate limit headers, ...). */
  headers?: Record<string, string>;
}

export function newRequestId(): string {
  return `req_${crypto.randomUUID().replace(/-/g, "")}`;
}

export function errorStatus(code: ApiErrorCode): number {
  return ERRORS[code].status;
}

export function apiError(
  code: ApiErrorCode,
  requestId: string,
  baseHeaders: Record<string, string>,
  options: ApiErrorOptions = {},
): Response {
  const spec = ERRORS[code];

  const body = {
    error: {
      type: spec.type,
      code,
      message: options.message ?? spec.message,
      status: spec.status,
      request_id: requestId,
      documentation_url: `${DOCS_BASE_URL}#${spec.anchor}`,
      ...(options.details ? { details: options.details } : {}),
    },
  };

  return new Response(JSON.stringify(body, null, 2), {
    status: spec.status,
    headers: {
      ...baseHeaders,
      ...(options.headers ?? {}),
      "Content-Type": "application/json; charset=utf-8",
      "X-Request-Id": requestId,
      "Cache-Control": "no-store",
    },
  });
}

export function apiSuccess(
  payload: unknown,
  requestId: string,
  baseHeaders: Record<string, string>,
  extraHeaders: Record<string, string> = {},
  status = 200,
): Response {
  return new Response(JSON.stringify(payload, null, 2), {
    status,
    headers: {
      ...baseHeaders,
      ...extraHeaders,
      "Content-Type": "application/json; charset=utf-8",
      "X-Request-Id": requestId,
    },
  });
}
