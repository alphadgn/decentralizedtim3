/**
 * Tiered rate limiting for the public API.
 *
 * Design notes, because the details are what make an API pleasant to use:
 *
 *  - Two windows per caller. A short *burst* window absorbs the natural
 *    spikiness of real clients (page loads, retries, parallel workers) while a
 *    longer *sustained* window enforces the plan. A single 60s window would
 *    either be too tight for bursts or too loose to protect the backend.
 *
 *  - Buckets are keyed by API key, falling back to IP only for anonymous
 *    traffic. Keying everything by IP — as the previous implementation did —
 *    punishes customers behind shared egress (offices, cloud NAT, mobile
 *    carriers) and is trivially sidestepped by rotating source addresses.
 *
 *  - The bucket key does NOT include the endpoint. Per-endpoint buckets let a
 *    caller multiply their allowance by fanning out across routes.
 *
 *  - Exceeding a limit costs you the remainder of the window and nothing more.
 *    There is no escalating lockout for ordinary overuse: a developer testing a
 *    loop should get a clean 429 with Retry-After, not an hour-long ban.
 *
 *  - Every response carries the limit headers, not just the 429s, so clients
 *    can pace themselves proactively.
 */

import type { Tier } from "./api-auth.ts";

export interface TierPolicy {
  /** Short window that smooths out bursts. */
  burst: { limit: number; windowSeconds: number };
  /** Plan-level sustained throughput. */
  sustained: { limit: number; windowSeconds: number };
  /** Requests per calendar month; -1 means uncapped. */
  monthlyQuota: number;
}

export const TIER_POLICIES: Record<Tier, TierPolicy> = {
  anonymous: {
    burst:     { limit: 10,  windowSeconds: 5 },
    sustained: { limit: 30,  windowSeconds: 60 },
    monthlyQuota: -1,
  },
  free: {
    burst:     { limit: 20,  windowSeconds: 5 },
    sustained: { limit: 60,  windowSeconds: 60 },
    monthlyQuota: 100_000,
  },
  pro: {
    burst:     { limit: 60,  windowSeconds: 5 },
    sustained: { limit: 300, windowSeconds: 60 },
    monthlyQuota: 1_000_000,
  },
  enterprise: {
    burst:     { limit: 200,  windowSeconds: 5 },
    sustained: { limit: 1200, windowSeconds: 60 },
    monthlyQuota: -1,
  },
};

/**
 * Per-endpoint request cost. Endpoints that fan out into consensus rounds,
 * Merkle batching and post-quantum signing are genuinely more expensive than a
 * clock read, and charging them at 1:1 would let a handful of callers saturate
 * the backend while nominally staying "within limits".
 */
export const DEFAULT_COST = 1;

export interface RateLimitDecision {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetSeconds: number;
  retryAfter: number;
  /** Which window rejected the request, for the error message. */
  scope: "burst" | "sustained" | null;
}

interface RpcResult {
  allowed: boolean;
  remaining: number;
  reset_seconds: number;
  retry_after: number;
}

async function consume(
  supabase: any,
  bucketKey: string,
  limit: number,
  windowSeconds: number,
  cost: number,
): Promise<RpcResult> {
  const { data, error } = await supabase.rpc("consume_rate_limit", {
    _bucket_key: bucketKey,
    _limit: limit,
    _window_seconds: windowSeconds,
    _cost: cost,
  });

  if (error) {
    // Fail open rather than take the whole API down if the counter store is
    // unavailable — availability of a read-only clock API matters more than
    // perfect enforcement, and the abuse ceiling is still the platform's.
    console.error("consume_rate_limit failed:", error);
    return { allowed: true, remaining: limit, reset_seconds: windowSeconds, retry_after: 0 };
  }

  const row = Array.isArray(data) ? data[0] : data;
  if (!row) {
    return { allowed: true, remaining: limit, reset_seconds: windowSeconds, retry_after: 0 };
  }
  return row as RpcResult;
}

/**
 * Consumes from the burst window first, then the sustained window.
 *
 * The burst check runs first so that a caller hammering the API is stopped by
 * the cheap short window before they can chew through their per-minute
 * allowance in a fraction of a second.
 */
export async function checkRateLimit(
  supabase: any,
  identity: string,
  tier: Tier,
  cost: number = DEFAULT_COST,
): Promise<RateLimitDecision> {
  const policy = TIER_POLICIES[tier];

  const burst = await consume(
    supabase,
    `burst:${identity}`,
    policy.burst.limit,
    policy.burst.windowSeconds,
    cost,
  );

  if (!burst.allowed) {
    return {
      allowed: false,
      limit: policy.sustained.limit,
      remaining: 0,
      resetSeconds: burst.reset_seconds,
      retryAfter: Math.max(1, burst.retry_after),
      scope: "burst",
    };
  }

  const sustained = await consume(
    supabase,
    `sustained:${identity}`,
    policy.sustained.limit,
    policy.sustained.windowSeconds,
    cost,
  );

  return {
    allowed: sustained.allowed,
    limit: policy.sustained.limit,
    remaining: sustained.remaining,
    resetSeconds: sustained.reset_seconds,
    retryAfter: sustained.allowed ? 0 : Math.max(1, sustained.retry_after),
    scope: sustained.allowed ? null : "sustained",
  };
}

/**
 * Emits both the IETF draft `RateLimit-*` headers and the widely-deployed
 * `X-RateLimit-*` spelling, since most existing client libraries still look
 * for the latter.
 */
export function rateLimitHeaders(
  decision: RateLimitDecision,
  tier: Tier,
): Record<string, string> {
  const policy = TIER_POLICIES[tier];

  const headers: Record<string, string> = {
    "RateLimit-Limit": String(decision.limit),
    "RateLimit-Remaining": String(decision.remaining),
    "RateLimit-Reset": String(decision.resetSeconds),
    "RateLimit-Policy":
      `${policy.burst.limit};w=${policy.burst.windowSeconds}, ` +
      `${policy.sustained.limit};w=${policy.sustained.windowSeconds}`,
    "X-RateLimit-Limit": String(decision.limit),
    "X-RateLimit-Remaining": String(decision.remaining),
    "X-RateLimit-Reset": String(decision.resetSeconds),
    "X-RateLimit-Tier": tier,
  };

  if (!decision.allowed) {
    headers["Retry-After"] = String(decision.retryAfter);
  }

  return headers;
}

/** Marks a bucket as blocked. Reserved for honeypot hits and clear abuse. */
export async function blockIdentity(
  supabase: any,
  identity: string,
  seconds: number,
): Promise<void> {
  const { error } = await supabase.rpc("block_rate_limit_bucket", {
    _bucket_key: `sustained:${identity}`,
    _seconds: seconds,
  });
  if (error) console.error("block_rate_limit_bucket failed:", error);
}
