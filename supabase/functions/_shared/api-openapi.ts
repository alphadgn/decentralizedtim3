/**
 * OpenAPI 3.1 description of the public API.
 *
 * This document is the contract. It is served verbatim at GET /openapi.json
 * and rendered by Swagger UI at GET /docs, so anything documented here must
 * match the router in api-gateway/index.ts.
 */

import { TIER_POLICIES } from "./api-rate-limit.ts";
import { DOCS_BASE_URL, PUBLIC_BASE_URL } from "./api-errors.ts";

const DESCRIPTION = `
Canonical, verifiable time for distributed systems.

The API returns a Byzantine-fault-tolerant consensus timestamp derived from a
quorum of independent signal sources, together with the evidence needed to
verify it after the fact — consensus hashes, validator signatures, Merkle
inclusion proofs and public blockchain anchors.

# Authentication

Send your API key as a bearer token:

\`\`\`
curl ${PUBLIC_BASE_URL}/v1/time \\
  -H "Authorization: Bearer dgtn_live_..."
\`\`\`

\`X-API-Key: dgtn_live_...\` is accepted as an alternative for clients that
reserve the \`Authorization\` header.

Keys are shown once at creation. Store them in a secret manager; never ship one
in browser or mobile code. If a key leaks, revoke it from the dashboard — the
change is effective immediately.

\`GET /v1/time\` and \`GET /v1/anchors\` also work with no key at all, at the
anonymous rate limit. Everything else requires a key.

# Rate limits

Every response carries the current limit state, including successful ones, so
you can pace yourself rather than discover the limit by hitting it:

| Header | Meaning |
| --- | --- |
| \`RateLimit-Limit\` | Sustained requests permitted per window |
| \`RateLimit-Remaining\` | Requests left in the current window |
| \`RateLimit-Reset\` | Seconds until the window resets |
| \`RateLimit-Policy\` | Both windows, as \`limit;w=seconds\` |
| \`Retry-After\` | On \`429\` only: seconds to wait |

Two windows apply. A short burst window absorbs normal spikiness; a longer
window enforces your plan.

| Plan | Burst | Sustained | Monthly |
| --- | --- | --- | --- |
| Anonymous | ${TIER_POLICIES.anonymous.burst.limit} / ${TIER_POLICIES.anonymous.burst.windowSeconds}s | ${TIER_POLICIES.anonymous.sustained.limit} / min | — |
| Free | ${TIER_POLICIES.free.burst.limit} / ${TIER_POLICIES.free.burst.windowSeconds}s | ${TIER_POLICIES.free.sustained.limit} / min | ${TIER_POLICIES.free.monthlyQuota.toLocaleString("en-US")} |
| Pro | ${TIER_POLICIES.pro.burst.limit} / ${TIER_POLICIES.pro.burst.windowSeconds}s | ${TIER_POLICIES.pro.sustained.limit} / min | ${TIER_POLICIES.pro.monthlyQuota.toLocaleString("en-US")} |
| Enterprise | ${TIER_POLICIES.enterprise.burst.limit} / ${TIER_POLICIES.enterprise.burst.windowSeconds}s | ${TIER_POLICIES.enterprise.sustained.limit} / min | Unmetered |

Limits are counted per API key, not per IP address, so deployments behind
shared egress (cloud NAT, corporate proxies) get their full allowance. Requests
made without a key are counted per IP.

Some endpoints cost more than one request against your limit, because they run
consensus rounds and generate proofs. The cost is listed on each endpoint.

Exceeding a limit returns \`429\` and costs you the remainder of the window —
nothing more. There is no escalating lockout for ordinary overuse.

**Handling 429 correctly:** wait for \`Retry-After\`, then retry with full
jitter. Retrying immediately or in lockstep across workers will simply
re-trigger the limit.

# Errors

Every error shares one envelope with a stable \`code\` you can branch on. Never
match on \`message\` — that text may be reworded.

\`\`\`json
{
  "error": {
    "type": "rate_limit_error",
    "code": "rate_limit_exceeded",
    "message": "Too many requests. Retry in 12 seconds.",
    "status": 429,
    "request_id": "req_9f2c1a4e...",
    "documentation_url": "${DOCS_BASE_URL}#rate-limits"
  }
}
\`\`\`

Quote the \`request_id\` in support requests. It is also returned on success as
the \`X-Request-Id\` header.

| Status | Retry? |
| --- | --- |
| \`400\` \`invalid_request\` | No — fix the request |
| \`401\` \`invalid_api_key\` | No — check the key |
| \`402\` \`quota_exceeded\` | No — upgrade or wait for the reset |
| \`403\` \`insufficient_tier\` / \`insufficient_scope\` | No |
| \`404\` \`not_found\` | No |
| \`429\` \`rate_limit_exceeded\` | Yes — after \`Retry-After\` |
| \`5xx\` \`internal_error\` | Yes — with exponential backoff |

# Scopes

Keys carry scopes and are refused on endpoints outside them, so a key embedded
in a constrained service can be narrowed to exactly what it needs:
\`time:read\`, \`anchors:read\`, \`analytics:read\`, \`risk:read\`, \`gmc:read\`,
\`gmc:write\`, \`orders:write\`.

# Signed requests

Optional, per key. Enable it on a key to require a proof-of-possession
signature alongside the bearer token, so a captured request cannot be replayed
or its body altered.

\`\`\`
X-Timestamp: 1785312000
X-Nonce: 5f4dcc3b5aa765d6
X-Signature: v1=<hex>
\`\`\`

Where the signature is \`HMAC-SHA256(api_key, signing_string)\` and:

\`\`\`
signing_string = "v1" : timestamp : nonce : METHOD : path : sha256(body)
\`\`\`

\`path\` is the public path (\`/v1/time\`), \`body\` is the exact raw bytes sent
(empty string for GET). Timestamps must be within 300s of server time and each
nonce is accepted once.

# Versioning

The path carries the major version. Within \`/v1\` we only ever add fields —
existing field names, types and semantics are stable. Parse defensively and
ignore unknown fields.

Unversioned \`/api/*\` paths are deprecated aliases kept for existing
integrations. They return \`Deprecation\` and \`Sunset\` headers. Use \`/v1\`.
`.trim();

const RATE_LIMIT_HEADERS = {
  "RateLimit-Limit": {
    schema: { type: "integer", examples: [300] },
    description: "Sustained requests permitted in the current window.",
  },
  "RateLimit-Remaining": {
    schema: { type: "integer", examples: [287] },
    description: "Requests remaining in the current window.",
  },
  "RateLimit-Reset": {
    schema: { type: "integer", examples: [42] },
    description: "Seconds until the current window resets.",
  },
  "RateLimit-Policy": {
    schema: { type: "string", examples: ["60;w=5, 300;w=60"] },
    description: "Active burst and sustained policies.",
  },
  "X-Request-Id": {
    schema: { type: "string", examples: ["req_9f2c1a4e8b7d4c2f9a1e"] },
    description: "Unique id for this request. Quote it in support requests.",
  },
} as const;

function errorResponse(description: string, code: string, status: number, extraHeaders = {}) {
  return {
    description,
    headers: { ...RATE_LIMIT_HEADERS, ...extraHeaders },
    content: {
      "application/json": {
        schema: { $ref: "#/components/schemas/Error" },
        example: {
          error: {
            type: status === 429 ? "rate_limit_error" : "invalid_request_error",
            code,
            message: "See documentation_url for how to resolve this.",
            status,
            request_id: "req_9f2c1a4e8b7d4c2f9a1e",
            documentation_url: `${DOCS_BASE_URL}#errors`,
          },
        },
      },
    },
  };
}

const COMMON_RESPONSES = {
  400: errorResponse("The request was malformed.", "invalid_request", 400),
  401: errorResponse("Missing, invalid, expired or revoked API key.", "invalid_api_key", 401),
  402: errorResponse("Monthly quota exhausted. Upgrade or wait for the reset.", "quota_exceeded", 402),
  403: errorResponse("Your plan or key scope does not cover this endpoint.", "insufficient_tier", 403),
  404: errorResponse("No such resource.", "not_found", 404),
  429: errorResponse("Rate limit exceeded. Wait for Retry-After, then retry with jitter.", "rate_limit_exceeded", 429, {
    "Retry-After": {
      schema: { type: "integer", examples: [12] },
      description: "Seconds to wait before retrying.",
    },
  }),
  500: errorResponse("Unexpected server error. Safe to retry with backoff.", "internal_error", 500),
};

/** Attaches the shared error responses to an endpoint's own success response. */
function withCommon(successResponse: Record<string, unknown>, codes: number[]) {
  const responses: Record<string, unknown> = { 200: successResponse };
  for (const code of codes) {
    responses[String(code)] = COMMON_RESPONSES[code as keyof typeof COMMON_RESPONSES];
  }
  return responses;
}

function jsonResponse(description: string, schemaRef: string, example?: unknown) {
  return {
    description,
    headers: RATE_LIMIT_HEADERS,
    content: {
      "application/json": {
        schema: { $ref: `#/components/schemas/${schemaRef}` },
        ...(example ? { example } : {}),
      },
    },
  };
}

export function buildOpenApiSpec(): Record<string, unknown> {
  return {
    openapi: "3.1.0",
    info: {
      title: "DefiTime API",
      version: "1.0.0",
      summary: "Verifiable consensus time and tamper-evident event ordering.",
      description: DESCRIPTION,
      // Email only: the site has no /support or /terms route, and a contact
      // link that 404s is worse than no link at all.
      contact: {
        name: "API support",
        email: "decentralizedtim3@gmail.com",
      },
      license: { name: "Proprietary" },
    },

    servers: [{ url: PUBLIC_BASE_URL, description: "Production" }],

    tags: [
      { name: "Time", description: "Consensus timestamps and network health." },
      { name: "Anchors", description: "Public blockchain anchoring status." },
      { name: "Analytics", description: "Aggregate network analytics and risk posture." },
      { name: "Global Market Clock", description: "Trade commitment, ordering and cryptographic proof. Enterprise only." },
      { name: "System", description: "Service health and machine-readable schema." },
    ],

    security: [{ bearerAuth: [] }],

    paths: {
      "/v1/health": {
        get: {
          tags: ["System"],
          summary: "Service health",
          description: "Liveness probe. Never rate limited, never requires a key. Safe to poll.",
          operationId: "getHealth",
          security: [],
          responses: {
            200: jsonResponse("Service is reachable.", "HealthResponse", {
              status: "ok",
              version: "1.0.0",
              time: "2026-07-28T09:30:00.000Z",
            }),
          },
        },
      },

      "/v1/time": {
        get: {
          tags: ["Time"],
          summary: "Current consensus time",
          description: [
            "Returns the current canonical timestamp agreed by the validator quorum.",
            "",
            "Outliers are trimmed before averaging, so a minority of drifting or",
            "hostile sources cannot move the result.",
            "",
            "**Cost:** 1 request. **Scope:** `time:read`. Works without a key at the",
            "anonymous rate limit.",
            "",
            "Response detail depends on your plan — higher plans add fields, they never",
            "rename or remove them. Free and anonymous callers receive the timestamp",
            "rounded to 100ms and qualitative bands; Pro adds node counts and drift",
            "bands; Enterprise adds exact drift, consensus hashes and per-source detail.",
          ].join("\n"),
          operationId: "getTime",
          security: [{ bearerAuth: [] }, {}],
          responses: withCommon(
            jsonResponse("The current consensus timestamp.", "TimeResponse", {
              timestamp: 1785312000000,
              iso: "2026-07-28T09:30:00.000Z",
              accuracy_band: "high",
              signal_band: "strong",
              consensus_status: "verified",
            }),
            [401, 402, 403, 429, 500],
          ),
        },
      },

      "/v1/anchors": {
        get: {
          tags: ["Anchors"],
          summary: "Blockchain anchor status",
          description: [
            "Reports where the consensus hash chain is currently anchored on public",
            "chains, and how fresh each anchor is. Use this to prove that a timestamp",
            "you were issued existed at a given block height.",
            "",
            "**Cost:** 1 request. **Scope:** `anchors:read`. Works without a key.",
          ].join("\n"),
          operationId: "getAnchors",
          security: [{ bearerAuth: [] }, {}],
          responses: withCommon(
            jsonResponse("Current anchor status per chain.", "AnchorsResponse", {
              timestamp: 1785312000000,
              iso: "2026-07-28T09:30:00.000Z",
              accuracy_band: "high",
              signal_band: "strong",
              consensus_status: "verified",
              anchors: [
                {
                  blockchain: "ethereum_sepolia",
                  status: "synced",
                  block_number: 7421903,
                  tx_hash: "0x3f8a...",
                  anchored_at: "2026-07-28T09:28:11.000Z",
                },
              ],
            }),
            [401, 402, 403, 429, 500],
          ),
        },
      },

      "/v1/insights": {
        get: {
          tags: ["Analytics"],
          summary: "Network analytics",
          description: [
            "Aggregate network health: query volume, response latency, consensus rate,",
            "node uptime and geographic distribution.",
            "",
            "**Cost:** 2 requests. **Scope:** `analytics:read`. Requires a key.",
          ].join("\n"),
          operationId: "getInsights",
          responses: withCommon(
            jsonResponse("Aggregate analytics for the network.", "InsightsResponse"),
            [401, 402, 403, 429, 500],
          ),
        },
      },

      "/v1/risk": {
        get: {
          tags: ["Analytics"],
          summary: "Network risk posture",
          description: [
            "Current network health and risk banding, including anomaly detection state.",
            "",
            "**Cost:** 2 requests. **Scope:** `risk:read`. Requires a key.",
          ].join("\n"),
          operationId: "getRisk",
          responses: withCommon(
            jsonResponse("Current risk assessment.", "RiskResponse"),
            [401, 402, 403, 429, 500],
          ),
        },
      },

      "/v1/orders": {
        post: {
          tags: ["Global Market Clock"],
          summary: "Timestamp an order event",
          description: [
            "Assigns a canonical timestamp and monotonic sequence number to an order",
            "event, and records it in the tamper-evident ledger.",
            "",
            "**Cost:** 5 requests. **Scope:** `orders:write`. **Enterprise only.**",
          ].join("\n"),
          operationId: "createOrderEvent",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/OrderRequest" },
                example: {
                  exchangeId: "exchange-alpha",
                  orderData: { symbol: "BTC-USD", side: "buy", quantity: "1.5" },
                },
              },
            },
          },
          responses: withCommon(
            jsonResponse("The order event was recorded.", "OrderResponse"),
            [400, 401, 402, 403, 429, 500],
          ),
        },
      },

      "/v1/gmc/commit_trade": {
        post: {
          tags: ["Global Market Clock"],
          summary: "Commit a trade to the ledger",
          description: [
            "Commits a trade hash to the Global Market Clock. Returns the canonical",
            "timestamp, deterministic sequence number, validator signatures and a",
            "verification proof.",
            "",
            "Ordering is latency-neutral: the canonical time is the median receive time",
            "across geographically distributed validators, so a participant closer to",
            "the network cannot buy priority.",
            "",
            "Commitments are batched into a Merkle tree and anchored to public chains",
            "shortly after acceptance; poll `/v1/gmc/event_proof/{event_id}` for the",
            "inclusion proof once `status` becomes `anchored`.",
            "",
            "`nonce` must be unique per `exchange_id`; a repeat is rejected as a replay.",
            "",
            "**Cost:** 5 requests. **Scope:** `gmc:write`. **Enterprise only.**",
          ].join("\n"),
          operationId: "commitTrade",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/CommitTradeRequest" },
                example: {
                  exchange_id: "exchange-alpha",
                  trade_id: "T-100294",
                  trade_hash: "9f2c1a4e8b7d4c2f9a1e6b3d5c7e9f1a3b5d7f9e1c3a5b7d9f1e3c5a7b9d1f3e",
                  client_signature: "0xabc123...",
                  nonce: "5f4dcc3b5aa765d6",
                },
              },
            },
          },
          responses: withCommon(
            jsonResponse("The trade was committed.", "CommitTradeResponse"),
            [400, 401, 402, 403, 429, 500],
          ),
        },
      },

      "/v1/gmc/verify_timestamp": {
        post: {
          tags: ["Global Market Clock"],
          summary: "Verify a committed timestamp",
          description: [
            "Independently re-derives the ordering hash for a committed event and",
            "checks it against the stored value, verifying the Merkle inclusion proof",
            "where one exists. Use this to prove a timestamp was not altered after",
            "the fact.",
            "",
            "**Cost:** 2 requests. **Scope:** `gmc:read`. **Enterprise only.**",
          ].join("\n"),
          operationId: "verifyTimestamp",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/VerifyTimestampRequest" },
                example: {
                  event_hash: "9f2c1a4e8b7d4c2f9a1e6b3d5c7e9f1a3b5d7f9e1c3a5b7d9f1e3c5a7b9d1f3e",
                  timestamp: 1785312000000,
                },
              },
            },
          },
          responses: withCommon(
            jsonResponse("Verification result.", "VerifyTimestampResponse"),
            [400, 401, 402, 403, 429, 500],
          ),
        },
      },

      "/v1/gmc/event_proof/{event_id}": {
        get: {
          tags: ["Global Market Clock"],
          summary: "Fetch a full event proof",
          description: [
            "Returns the complete verification bundle for a committed event: validator",
            "signatures, Merkle inclusion proof, and the blockchain anchor it falls",
            "under.",
            "",
            "**Cost:** 2 requests. **Scope:** `gmc:read`. **Enterprise only.**",
          ].join("\n"),
          operationId: "getEventProof",
          parameters: [{
            name: "event_id",
            in: "path",
            required: true,
            description: "The event hash returned by commit_trade, or the commitment's UUID.",
            schema: { type: "string" },
            example: "9f2c1a4e8b7d4c2f9a1e6b3d5c7e9f1a3b5d7f9e1c3a5b7d9f1e3c5a7b9d1f3e",
          }],
          responses: withCommon(
            jsonResponse("The verification bundle.", "EventProofResponse"),
            [401, 402, 403, 404, 429, 500],
          ),
        },
      },

      "/v1/gmc/ledger_block/{batch_id}": {
        get: {
          tags: ["Global Market Clock"],
          summary: "Fetch a ledger block",
          description: [
            "Returns a batch of committed events with the Merkle root covering them.",
            "",
            "Pass `latest` for the most recent 50 events, or a sequence range such as",
            "`1000-1050`.",
            "",
            "**Cost:** 2 requests. **Scope:** `gmc:read`. **Enterprise only.**",
          ].join("\n"),
          operationId: "getLedgerBlock",
          parameters: [{
            name: "batch_id",
            in: "path",
            required: true,
            description: "`latest`, or an inclusive sequence range like `1000-1050`.",
            schema: { type: "string" },
            example: "latest",
          }],
          responses: withCommon(
            jsonResponse("The ledger block.", "LedgerBlockResponse"),
            [401, 402, 403, 429, 500],
          ),
        },
      },
    },

    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          description: "Your API key, e.g. `Authorization: Bearer dgtn_live_...`",
        },
        apiKeyHeader: {
          type: "apiKey",
          in: "header",
          name: "X-API-Key",
          description: "Alternative to the Authorization header.",
        },
      },

      schemas: {
        Error: {
          type: "object",
          required: ["error"],
          properties: {
            error: {
              type: "object",
              required: ["type", "code", "message", "status", "request_id"],
              properties: {
                type: {
                  type: "string",
                  description: "Broad error family.",
                  enum: [
                    "authentication_error",
                    "authorization_error",
                    "invalid_request_error",
                    "rate_limit_error",
                    "quota_error",
                    "not_found_error",
                    "api_error",
                  ],
                },
                code: { type: "string", description: "Stable, specific code. Branch on this." },
                message: { type: "string", description: "Human-readable. May be reworded; do not parse." },
                status: { type: "integer", description: "HTTP status, repeated for convenience." },
                request_id: { type: "string", description: "Quote this in support requests." },
                documentation_url: { type: "string", format: "uri" },
                details: { type: "object", additionalProperties: true },
              },
            },
          },
        },

        HealthResponse: {
          type: "object",
          properties: {
            status: { type: "string", enum: ["ok"] },
            version: { type: "string" },
            time: { type: "string", format: "date-time" },
          },
        },

        TimeResponse: {
          type: "object",
          description: "Higher plans add fields. Field names and meanings never change within /v1.",
          properties: {
            timestamp: {
              type: "integer",
              format: "int64",
              description: "Canonical consensus time, milliseconds since the Unix epoch. Rounded to 100ms on Free and anonymous.",
            },
            iso: { type: "string", format: "date-time", description: "`timestamp` as an ISO 8601 string." },
            accuracy_band: {
              type: "string",
              enum: ["high", "medium", "low"],
              description: "Qualitative accuracy. All plans.",
            },
            signal_band: {
              type: "string",
              enum: ["strong", "moderate", "weak"],
              description: "Qualitative signal quality. All plans.",
            },
            consensus_status: {
              type: "string",
              enum: ["verified", "syncing"],
              description: "Whether the quorum currently agrees. All plans.",
            },
            node_count: { type: "integer", description: "Validators in the quorum. Pro and above." },
            drift_band: {
              type: "string",
              enum: ["minimal", "low", "moderate"],
              description: "Qualitative drift. Pro and above.",
            },
            analytics_summary: {
              type: "object",
              additionalProperties: true,
              description: "Condensed network metrics. Pro and above.",
            },
            accuracy: { type: "number", description: "Accuracy in milliseconds. Enterprise only." },
            drift_ms: { type: "number", description: "Signed drift from wall clock, in milliseconds. Enterprise only." },
            signal_strength: { type: "string", description: "Precise signal classification. Enterprise only." },
            consensus_hash: { type: "string", description: "SHA-256 over the consensus inputs. Enterprise only." },
            sources: { type: "integer", description: "Independent sources contributing. Enterprise only." },
            analytics: { type: "object", additionalProperties: true, description: "Full analytics. Enterprise only." },
          },
        },

        AnchorStatus: {
          type: "object",
          properties: {
            blockchain: { type: "string", examples: ["ethereum_sepolia", "solana_devnet", "polygon_amoy"] },
            status: { type: "string", enum: ["synced", "syncing", "stale"] },
            block_number: { type: "integer", format: "int64" },
            tx_hash: { type: "string" },
            anchored_at: { type: "string", format: "date-time" },
          },
        },

        AnchorsResponse: {
          allOf: [
            { $ref: "#/components/schemas/TimeResponse" },
            {
              type: "object",
              properties: {
                anchors: {
                  type: "array",
                  items: { $ref: "#/components/schemas/AnchorStatus" },
                },
              },
            },
          ],
        },

        InsightsResponse: {
          allOf: [
            { $ref: "#/components/schemas/TimeResponse" },
            {
              type: "object",
              properties: {
                analytics: {
                  type: "object",
                  properties: {
                    total_queries_24h: { type: "integer" },
                    avg_response_ms: { type: "number" },
                    consensus_rate: { type: "number" },
                    node_uptime: { type: "number" },
                    geographic_distribution: { type: "object", additionalProperties: true },
                  },
                },
              },
            },
          ],
        },

        RiskResponse: {
          allOf: [
            { $ref: "#/components/schemas/TimeResponse" },
            {
              type: "object",
              properties: {
                analytics: {
                  type: "object",
                  properties: {
                    network_health_score: { type: "string", enum: ["excellent", "healthy", "degraded"] },
                    risk_level: { type: "string", enum: ["low", "moderate", "high"] },
                    anomaly_detection: { type: "string" },
                  },
                },
              },
            },
          ],
        },

        OrderRequest: {
          type: "object",
          required: ["exchangeId", "orderData"],
          properties: {
            exchangeId: { type: "string", maxLength: 50, description: "Your exchange or venue identifier." },
            orderData: { type: "object", additionalProperties: true, description: "The order payload to bind to the timestamp." },
          },
        },

        OrderResponse: {
          type: "object",
          properties: {
            timestamp: { type: "integer", format: "int64" },
            iso: { type: "string", format: "date-time" },
            sequence: { type: "integer", format: "int64", description: "Monotonic sequence number." },
            verification_hash: { type: "string" },
            consensus_hash: { type: "string" },
            consensus_status: { type: "string" },
            node_count: { type: "integer" },
          },
        },

        CommitTradeRequest: {
          type: "object",
          required: ["exchange_id", "trade_id", "trade_hash", "client_signature", "nonce"],
          properties: {
            exchange_id: { type: "string", maxLength: 50 },
            trade_id: { type: "string", maxLength: 100 },
            trade_hash: { type: "string", maxLength: 128, description: "Hash of the trade payload. The payload itself never leaves your systems." },
            client_signature: { type: "string", description: "Your signature over `trade_hash`." },
            nonce: { type: "string", maxLength: 64, description: "Unique per `exchange_id`. Reuse is rejected as a replay." },
          },
        },

        ValidatorSignature: {
          type: "object",
          properties: {
            validator_id: { type: "string" },
            region: { type: "string" },
            signature: { type: "string" },
            timestamp: { type: "integer", format: "int64" },
            propagation_delay_ms: { type: "number" },
            verified: { type: "boolean" },
          },
        },

        CommitTradeResponse: {
          type: "object",
          properties: {
            timestamp: { type: "integer", format: "int64", description: "Canonical, latency-neutral commit time." },
            iso: { type: "string", format: "date-time" },
            sequence_number: { type: "integer", format: "int64" },
            event_hash: { type: "string", description: "Identifier for later proof retrieval." },
            ordering_hash: { type: "string", description: "Deterministic tie-breaker for identical timestamps." },
            verification_proof: { type: "string" },
            trade_id: { type: "string" },
            exchange_id: { type: "string" },
            status: { type: "string", enum: ["committed", "anchored"] },
            validator_signatures: { type: "array", items: { $ref: "#/components/schemas/ValidatorSignature" } },
            latency_neutral: { type: "object", additionalProperties: true },
            post_quantum: { type: "object", additionalProperties: true, description: "CRYSTALS-Dilithium3 attestations." },
            formal_verification: { type: "object", additionalProperties: true },
            distributed_audit: { type: "object", additionalProperties: true },
          },
        },

        VerifyTimestampRequest: {
          type: "object",
          required: ["event_hash"],
          properties: {
            event_hash: { type: "string" },
            timestamp: { type: "integer", format: "int64", description: "Optional. When supplied, checked against the canonical value." },
          },
        },

        VerifyTimestampResponse: {
          type: "object",
          properties: {
            verified: { type: "boolean", description: "True only if integrity and, where supplied, the claimed timestamp both check out." },
            canonical_timestamp: { type: "integer", format: "int64" },
            iso: { type: "string", format: "date-time" },
            sequence_number: { type: "integer", format: "int64" },
            event_hash: { type: "string" },
            ordering_hash: { type: "string" },
            integrity_valid: { type: "boolean" },
            timestamp_match: { type: "boolean" },
            merkle_verified: { type: ["boolean", "null"], description: "Null until the event has been batched." },
            merkle_root: { type: ["string", "null"] },
            blockchain_anchor_ref: { type: ["string", "null"] },
            validator_count: { type: "integer" },
            consensus_status: { type: "string", enum: ["verified", "tampered", "unverified"] },
          },
        },

        EventProofResponse: {
          type: "object",
          properties: {
            event_hash: { type: "string" },
            timestamp: { type: "integer", format: "int64" },
            iso: { type: "string", format: "date-time" },
            sequence_number: { type: "integer", format: "int64" },
            ordering_hash: { type: "string" },
            exchange_id: { type: "string" },
            trade_id: { type: "string" },
            trade_hash: { type: "string" },
            validator_signatures: { type: "array", items: { $ref: "#/components/schemas/ValidatorSignature" } },
            verification_proof: { type: "string" },
            merkle_proof: { type: ["object", "null"], additionalProperties: true },
            merkle_verified: { type: ["boolean", "null"] },
            blockchain_anchor: { type: ["object", "null"], additionalProperties: true },
            status: { type: "string" },
            verification_bundle: { type: "object", additionalProperties: true },
          },
        },

        LedgerBlockResponse: {
          type: "object",
          properties: {
            batch_id: { type: "string" },
            merkle_root: { type: "string" },
            tree_depth: { type: "integer" },
            event_count: { type: "integer" },
            anchored_count: { type: "integer" },
            pending_count: { type: "integer" },
            events: { type: "array", items: { type: "object", additionalProperties: true } },
            created_at: { type: "string", format: "date-time" },
          },
        },
      },
    },
  };
}
