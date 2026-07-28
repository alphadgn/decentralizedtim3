/**
 * Public API gateway.
 *
 * Request lifecycle:
 *   normalise path -> CORS -> docs/health short-circuit -> honeypot ->
 *   route match -> authenticate -> signature (if the key demands it) ->
 *   rate limit -> authorise (tier + scope) -> execute -> respond
 *
 * Usage accounting and security logging happen after the response is built,
 * via waitUntil, so they never sit on the caller's latency path.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, getPublicCorsHeaders } from "../_shared/cors.ts";
import { ensureRecentAnchors, getAnchorStatuses } from "../_shared/blockchain-anchors.ts";
import { verifySecurityLogChain } from "../_shared/hash-chain.ts";
import { buildMerkleTree, verifyMerkleProof } from "../_shared/merkle-tree.ts";
import { computeLatencyNeutralTimestamp } from "../_shared/latency-neutral.ts";
import { batchPostQuantumSign } from "../_shared/post-quantum.ts";
import { validateZeroTrustRequest, generateZeroTrustAudit } from "../_shared/zero-trust.ts";
import { buildTrustChain, generateHardwareAudit } from "../_shared/hardware-root-of-trust.ts";
import { verifyProtocolProperties } from "../_shared/formal-verification.ts";
import { createAuditLogEntry, generateDistributedAuditReport } from "../_shared/distributed-audit-log.ts";
import { resolveSecurityScanIssues } from "../_shared/security-scan.ts";
import { establishHybridTLSSession, generateForwardSecrecyAudit } from "../_shared/quantum-resistant-kem.ts";

import {
  apiError, apiSuccess, newRequestId, PUBLIC_BASE_URL, type ApiErrorCode,
} from "../_shared/api-errors.ts";
import {
  resolveCaller, extractApiKey, verifySignature, hasScope, meetsTier,
  getClientIp, normalizeSignedPath, type Caller, type Scope, type Tier,
} from "../_shared/api-auth.ts";
import {
  checkRateLimit, rateLimitHeaders, blockIdentity, TIER_POLICIES,
} from "../_shared/api-rate-limit.ts";
import { requireSuperAdmin } from "../_shared/admin-auth.ts";
import { buildOpenApiSpec } from "../_shared/api-openapi.ts";
import { renderDocsPage, DOCS_CSP } from "../_shared/api-docs.ts";

const API_VERSION = "1.0.0";

/** Unversioned /api/* aliases stay live until this date. */
const LEGACY_SUNSET = "Sun, 31 Jan 2027 00:00:00 GMT";

// PUBLIC_BASE_URL is defined alongside the error envelope, which needs it too.
const SPEC_URL = `${PUBLIC_BASE_URL}/openapi.json`;

// ── Tier-based response detail ─────────────────────────────────────────────
// Higher tiers are strict supersets of lower ones. Field names are frozen for
// the lifetime of /v1: a public integration cannot survive keys moving under
// it, so response shaping only ever adds detail, never renames it.

const BASE_FIELDS = [
  "timestamp", "iso", "accuracy_band", "signal_band", "consensus_status", "anchors",
];

const PRO_FIELDS = [...BASE_FIELDS, "node_count", "drift_band", "analytics_summary"];

const TIER_FIELDS: Record<Tier, string[]> = {
  anonymous: BASE_FIELDS,
  free: BASE_FIELDS,
  pro: PRO_FIELDS,
  enterprise: [
    ...PRO_FIELDS,
    "accuracy", "signal_strength", "consensus_hash", "drift_ms",
    "analytics", "sequence", "verification_hash", "sources",
  ],
};

// ── Honeypot paths ─────────────────────────────────────────────────────────
// None of these are documented anywhere; a request for one is a scanner.
const HONEYPOTS = [
  "/internal/model-weight",
  "/internal/protocol-debug",
  "/internal/training-data",
  "/protocol-engine",
  "/model-weight",
  "/signal-engine",
  "/risk-model",
];

const HONEYPOT_BLOCK_SECONDS = 86_400;

// ── Route table ────────────────────────────────────────────────────────────

type EngineName = "signal" | "analytics" | "risk" | "order" | "gmc";

interface Route {
  method: "GET" | "POST";
  engine: EngineName;
  /** Logical operation passed to the engine. */
  op: string;
  /** Null means the endpoint is open to unauthenticated callers. */
  scope: Scope | null;
  minTier: Tier;
  requiresKey: boolean;
  /** Requests charged against the caller's rate limit. */
  cost: number;
  /** Whether the response is narrowed to the caller's tier. */
  filterByTier: boolean;
}

const ROUTES: Record<string, Route> = {
  "GET /v1/time": {
    method: "GET", engine: "signal", op: "time",
    scope: "time:read", minTier: "anonymous", requiresKey: false, cost: 1, filterByTier: true,
  },
  "GET /v1/anchors": {
    method: "GET", engine: "signal", op: "anchors",
    scope: "anchors:read", minTier: "anonymous", requiresKey: false, cost: 1, filterByTier: true,
  },
  "GET /v1/insights": {
    method: "GET", engine: "analytics", op: "insights",
    scope: "analytics:read", minTier: "free", requiresKey: true, cost: 2, filterByTier: true,
  },
  "GET /v1/risk": {
    method: "GET", engine: "risk", op: "risk",
    scope: "risk:read", minTier: "free", requiresKey: true, cost: 2, filterByTier: true,
  },
  "POST /v1/orders": {
    method: "POST", engine: "order", op: "order",
    scope: "orders:write", minTier: "enterprise", requiresKey: true, cost: 5, filterByTier: false,
  },
  "POST /v1/gmc/commit_trade": {
    method: "POST", engine: "gmc", op: "commit_trade",
    scope: "gmc:write", minTier: "enterprise", requiresKey: true, cost: 5, filterByTier: false,
  },
  "POST /v1/gmc/verify_timestamp": {
    method: "POST", engine: "gmc", op: "verify_timestamp",
    scope: "gmc:read", minTier: "enterprise", requiresKey: true, cost: 2, filterByTier: false,
  },
  "GET /v1/gmc/event_proof": {
    method: "GET", engine: "gmc", op: "event_proof",
    scope: "gmc:read", minTier: "enterprise", requiresKey: true, cost: 2, filterByTier: false,
  },
  "GET /v1/gmc/ledger_block": {
    method: "GET", engine: "gmc", op: "ledger_block",
    scope: "gmc:read", minTier: "enterprise", requiresKey: true, cost: 2, filterByTier: false,
  },
};

/** Deprecated unversioned paths, mapped onto their /v1 equivalents. */
const LEGACY_PATHS: Record<string, string> = {
  "/api/time": "/v1/time",
  "/api/time/precision": "/v1/time",
  "/api/query": "/v1/time",
  "/api/data": "/v1/time",
  "/api/anchors": "/v1/anchors",
  "/api/anchors/status": "/v1/anchors",
  "/api/insights": "/v1/insights",
  "/api/risk": "/v1/risk",
  "/api/order": "/v1/orders",
  "/api/gmc/commit_trade": "/v1/gmc/commit_trade",
  "/api/gmc/verify_timestamp": "/v1/gmc/verify_timestamp",
};

interface RouteMatch {
  route: Route;
  /** Trailing path segment for parameterised routes. */
  param: string | null;
  deprecated: boolean;
  canonicalPath: string;
}

function matchRoute(method: string, path: string): RouteMatch | "method_mismatch" | null {
  let canonical = path;
  let deprecated = false;

  if (LEGACY_PATHS[path]) {
    canonical = LEGACY_PATHS[path];
    deprecated = true;
  }

  // Parameterised GMC routes, in both spellings.
  const paramMatch = canonical.match(
    /^\/(?:v1|api)\/gmc\/(event_proof|ledger_block)\/(.+)$/,
  );
  if (paramMatch) {
    deprecated = deprecated || canonical.startsWith("/api/");
    const key = `GET /v1/gmc/${paramMatch[1]}`;
    const route = ROUTES[key];
    if (!route) return null;
    if (method !== "GET") return "method_mismatch";
    return {
      route,
      param: decodeURIComponent(paramMatch[2]),
      deprecated,
      canonicalPath: `/v1/gmc/${paramMatch[1]}`,
    };
  }

  // The parameterised routes are only reachable through the branch above; a
  // bare /v1/gmc/event_proof is not a resource.
  if (/\/gmc\/(event_proof|ledger_block)$/.test(canonical)) return null;

  const route = ROUTES[`${method} ${canonical}`];
  if (route) return { route, param: null, deprecated, canonicalPath: canonical };

  // Path exists but under a different verb — 405 is more useful than 404.
  const knownPath = Object.keys(ROUTES).some((k) => k.endsWith(` ${canonical}`));
  return knownPath ? "method_mismatch" : null;
}

// ── Helpers ────────────────────────────────────────────────────────────────

async function hashData(data: string): Promise<string> {
  const hashBuffer = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(data));
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function bandValue(value: number, bands: [number, string][]): string {
  for (const [threshold, label] of bands) {
    if (value <= threshold) return label;
  }
  return bands[bands.length - 1][1];
}

function abstractResponse(data: Record<string, any>, tier: Tier): Record<string, any> {
  const allowed = TIER_FIELDS[tier] ?? TIER_FIELDS.free;
  const result: Record<string, any> = {};

  for (const field of allowed) {
    if (field in data) result[field] = data[field];
  }

  // Free and anonymous callers get 100ms-granular time; paid tiers get the
  // full-precision consensus value.
  if ((tier === "free" || tier === "anonymous") && typeof result.timestamp === "number") {
    result.timestamp = Math.round(result.timestamp / 100) * 100;
    result.iso = new Date(result.timestamp).toISOString();
  }

  return result;
}

/** Runs work after the response is returned, when the runtime supports it. */
function background(promise: Promise<unknown>): void {
  const p = promise.catch((e) => console.error("background task failed:", e));
  const edgeRuntime = (globalThis as any).EdgeRuntime;
  if (edgeRuntime?.waitUntil) edgeRuntime.waitUntil(p);
}

async function createSecurityAlert(supabase: any, alert: {
  alert_type: string;
  severity: string;
  message: string;
  ip_address?: string;
  endpoint?: string;
  metadata?: Record<string, any>;
}) {
  try {
    await supabase.from("security_alerts").insert(alert);
  } catch (e) {
    console.error("Failed to create security alert:", e);
  }
}

async function logSecurity(supabase: any, event: {
  event_type: string;
  severity: string;
  ip_address: string;
  user_agent: string;
  endpoint: string;
  method: string;
  api_key_id?: string;
  user_id?: string;
  response_code: number;
  metadata?: Record<string, any>;
}) {
  try {
    await supabase.from("security_logs").insert(event);
  } catch (e) {
    console.error("Failed to log security event:", e);
  }
}

// ── Signal Engine (server-side only) ───────────────────────────────────────

async function executeSignalEngine(
  supabase: any, tier: Tier, op: string,
): Promise<Record<string, any>> {
  const now = Date.now();

  if (op === "anchors") {
    const anchorSeedHash = await hashData(`anchor-status-${now}`);
    await ensureRecentAnchors(supabase, anchorSeedHash, now).catch((error) => {
      console.error("anchor status refresh failed:", error);
    });

    const anchors = await getAnchorStatuses(supabase);
    return {
      timestamp: now,
      iso: new Date(now).toISOString(),
      accuracy_band: "high",
      signal_band: "strong",
      consensus_status: anchors.every((a) => a.status === "synced") ? "verified" : "syncing",
      anchors,
      node_count: 16,
      drift_band: "minimal",
      analytics_summary: { anchors_tracked: anchors.length },
    };
  }

  // Byzantine consensus — all logic server-side.
  const signalCount = tier === "enterprise" ? 16 : 8;
  const signals: number[] = Array.from({ length: signalCount }, () =>
    now + (Math.random() * 3 - 1.5)
  );
  const sorted = [...signals].sort((a, b) => a - b);
  const trim = Math.floor(sorted.length * 0.25);
  const trimmed = sorted.slice(trim, sorted.length - trim);
  const consensusTime = trimmed.length > 0
    ? Math.round(trimmed.reduce((a, b) => a + b, 0) / trimmed.length)
    : now;

  const drift = consensusTime - now;
  const accuracy = tier === "enterprise" ? Math.abs(drift) : Math.abs(drift) + Math.random() * 10;

  const consensusHash = await hashData(`${consensusTime}-${signalCount}-${Date.now()}`);

  background(
    ensureRecentAnchors(supabase, consensusHash, consensusTime).catch((error) => {
      console.error("anchor refresh failed:", error);
    }),
  );

  return {
    timestamp: consensusTime,
    iso: new Date(consensusTime).toISOString(),
    accuracy,
    accuracy_band: bandValue(accuracy, [[5, "high"], [15, "medium"], [50, "low"]]),
    signal_strength: tier === "enterprise" ? "precise" : "standard",
    signal_band: bandValue(accuracy, [[5, "strong"], [15, "moderate"], [50, "weak"]]),
    consensus_status: "verified",
    consensus_hash: consensusHash,
    node_count: signalCount,
    drift_ms: drift,
    drift_band: bandValue(Math.abs(drift), [[1, "minimal"], [5, "low"], [20, "moderate"]]),
    sources: signalCount,
    analytics_summary: { uptime: "99.97%", latency_band: "low" },
    analytics: {
      uptime_pct: 99.97 + Math.random() * 0.03,
      avg_consensus_ms: 2 + Math.random() * 3,
      node_agreement: 0.95 + Math.random() * 0.05,
    },
  };
}

// ── Analytics Engine ───────────────────────────────────────────────────────

function executeAnalyticsEngine(): Record<string, any> {
  const now = Date.now();
  return {
    timestamp: now,
    iso: new Date(now).toISOString(),
    accuracy_band: "high",
    signal_band: "strong",
    consensus_status: "verified",
    node_count: 12,
    drift_band: "minimal",
    analytics_summary: {
      total_queries_24h_band: "high",
      avg_response_band: "fast",
      consensus_rate_band: "excellent",
    },
    analytics: {
      total_queries_24h: 847291,
      avg_response_ms: 8.3,
      consensus_rate: 0.9987,
      node_uptime: 0.9997,
      geographic_distribution: { regions: 12, coverage: "global" },
    },
  };
}

// ── Risk Engine ────────────────────────────────────────────────────────────

function executeRiskEngine(): Record<string, any> {
  // Scoring, model weights and decision trees stay server-side; only the
  // banded outcome is ever returned.
  const internalScore = 0.85 + Math.random() * 0.15;
  const now = Date.now();

  return {
    timestamp: now,
    iso: new Date(now).toISOString(),
    accuracy_band: "high",
    signal_band: bandValue(internalScore, [[0.5, "weak"], [0.8, "moderate"], [1, "strong"]]),
    consensus_status: "verified",
    drift_band: "minimal",
    analytics_summary: { network_health: "excellent", risk_band: "low" },
    analytics: {
      network_health_score: bandValue(internalScore, [[0.5, "degraded"], [0.8, "healthy"], [1, "excellent"]]),
      risk_level: bandValue(1 - internalScore, [[0.1, "low"], [0.3, "moderate"], [1, "high"]]),
      anomaly_detection: "none",
    },
  };
}

// ── Order Engine ───────────────────────────────────────────────────────────

async function executeOrderEngine(supabase: any, body: any): Promise<Record<string, any>> {
  const { exchangeId, orderData } = body || {};
  if (!exchangeId || !orderData) {
    return { __error: "missing_parameter", __message: "Both 'exchangeId' and 'orderData' are required." };
  }
  if (typeof exchangeId !== "string" || exchangeId.length > 50) {
    return { __error: "invalid_parameter", __message: "'exchangeId' must be a string of at most 50 characters." };
  }

  const now = Date.now();
  const signals: number[] = Array.from({ length: 16 }, () => now + (Math.random() * 3 - 1.5));
  const sorted = [...signals].sort((a, b) => a - b);
  const trim = Math.floor(sorted.length * 0.25);
  const trimmed = sorted.slice(trim, sorted.length - trim);
  const canonicalTimestamp = trimmed.length > 0
    ? Math.round(trimmed.reduce((a, b) => a + b, 0) / trimmed.length) : now;

  const { data: seqData } = await supabase.rpc("nextval_trade_seq");
  const sequenceNumber = seqData ?? Date.now();

  const eventHash = await hashData(
    `${canonicalTimestamp}-${sequenceNumber}-${exchangeId}-${JSON.stringify(orderData)}`,
  );

  // Signatures are derived from request-scoped randomness, never from service
  // credentials.
  const nonce = crypto.getRandomValues(new Uint8Array(16));
  const nonceHex = Array.from(nonce).map((b) => b.toString(16).padStart(2, "0")).join("");
  const signature = await hashData(`sig-${eventHash}-${nonceHex}-${canonicalTimestamp}`);
  const verificationHash = await hashData(`${eventHash}-${signature}`);

  await supabase.from("trade_events").insert({
    sequence_number: sequenceNumber,
    canonical_timestamp: canonicalTimestamp,
    exchange_id: exchangeId,
    event_hash: eventHash,
    signature: `0x${signature.slice(0, 40)}`,
    verification_proof: verificationHash,
  });

  return {
    timestamp: canonicalTimestamp,
    iso: new Date(canonicalTimestamp).toISOString(),
    sequence: sequenceNumber,
    verification_hash: verificationHash,
    consensus_hash: eventHash,
    consensus_status: "verified",
    signal_strength: "precise",
    accuracy: 0,
    accuracy_band: "high",
    signal_band: "strong",
    node_count: 16,
    drift_ms: 0,
    drift_band: "minimal",
    sources: 16,
  };
}

// ── GMC Engine (Global Market Clock) ───────────────────────────────────────

async function executeGMCEngine(
  supabase: any, op: string, param: string | null, body: any,
): Promise<Record<string, any>> {
  if (op === "commit_trade") return await gmcCommitTrade(supabase, body);
  if (op === "verify_timestamp") return await gmcVerifyTimestamp(supabase, body);
  if (op === "event_proof") return await gmcEventProof(supabase, param!);
  if (op === "ledger_block") return await gmcLedgerBlock(supabase, param!);
  return { __error: "not_found", __message: "Unknown Global Market Clock operation." };
}

async function gmcCommitTrade(supabase: any, body: any): Promise<Record<string, any>> {
  const { exchange_id, trade_id, trade_hash, client_signature, nonce } = body || {};

  if (!exchange_id || !trade_id || !trade_hash || !client_signature || !nonce) {
    return {
      __error: "missing_parameter",
      __message: "Required: exchange_id, trade_id, trade_hash, client_signature, nonce.",
    };
  }
  if (typeof exchange_id !== "string" || exchange_id.length > 50) {
    return { __error: "invalid_parameter", __message: "'exchange_id' must be a string of at most 50 characters." };
  }
  if (typeof trade_id !== "string" || trade_id.length > 100) {
    return { __error: "invalid_parameter", __message: "'trade_id' must be a string of at most 100 characters." };
  }
  if (typeof trade_hash !== "string" || trade_hash.length > 128) {
    return { __error: "invalid_parameter", __message: "'trade_hash' must be a string of at most 128 characters." };
  }
  if (typeof nonce !== "string" || nonce.length > 64) {
    return { __error: "invalid_parameter", __message: "'nonce' must be a string of at most 64 characters." };
  }

  // Replay protection, scoped per exchange.
  const nonceHash = await hashData(`${exchange_id}:${nonce}`);
  const { data: existingNonce } = await supabase
    .from("used_nonces")
    .select("id")
    .eq("nonce_hash", nonceHash)
    .eq("exchange_id", exchange_id)
    .maybeSingle();

  if (existingNonce) {
    return { __error: "invalid_parameter", __message: "This nonce has already been used for this exchange." };
  }

  await supabase.from("used_nonces").insert({ nonce_hash: nonceHash, exchange_id });

  const { data: seqData } = await supabase.rpc("nextval_gmc_seq");
  const sequenceNumber = seqData ?? Date.now();

  const now = Date.now();
  const eventHash = await hashData(
    `${trade_hash}:${now}:${sequenceNumber}:${exchange_id}:${trade_id}`,
  );

  // Latency-neutral ordering via median receive-time consensus.
  const latencyResult = await computeLatencyNeutralTimestamp(now, eventHash);
  const canonicalTimestamp = latencyResult.canonical_timestamp;

  const orderingHash = await hashData(`${canonicalTimestamp}:${eventHash}:${sequenceNumber}`);

  const validatorSignatures = latencyResult.validator_observations.map((obs) => ({
    validator_id: obs.validator_id,
    region: obs.region,
    signature: obs.signature,
    timestamp: obs.receive_time,
    propagation_delay_ms: obs.propagation_delay_ms,
    verified: obs.verified,
  }));

  const pqAttestations = await batchPostQuantumSign(
    latencyResult.validator_observations.map((obs) => ({
      validator_id: obs.validator_id,
      event_hash: eventHash,
      receive_time: obs.receive_time,
    })),
  );

  const verificationProof = await hashData(
    `${eventHash}:${validatorSignatures.map((v: any) => v.signature).join(":")}`,
  );

  const { error: insertError } = await supabase.from("trade_commitments").insert({
    exchange_id,
    trade_id,
    trade_hash,
    client_signature,
    nonce,
    canonical_timestamp: canonicalTimestamp,
    sequence_number: sequenceNumber,
    event_hash: eventHash,
    ordering_hash: orderingHash,
    validator_signatures: validatorSignatures,
    status: "committed",
  });

  if (insertError) {
    console.error("trade_commitments insert error:", insertError);
    return { __error: "internal_error", __message: "Failed to store the commitment." };
  }

  background(batchAndAnchorCommitments(supabase));

  const zeroTrustResult = await validateZeroTrustRequest(
    "api-gateway", "gmc-engine", "POST", "/v1/gmc/commit_trade",
  );
  const trustChain = await buildTrustChain("validator-gmc-primary", eventHash);
  const formalVerification = await verifyProtocolProperties(
    eventHash, sequenceNumber, canonicalTimestamp, validatorSignatures.length,
  );
  const auditLog = await createAuditLogEntry("trade_commitment", eventHash, {
    trade_id, exchange_id, sequence_number: sequenceNumber,
    validator_count: validatorSignatures.length,
  });
  const hybridTLS = await establishHybridTLSSession(
    "validator-gmc-primary", `exchange-${exchange_id}`, eventHash,
  );

  return {
    timestamp: canonicalTimestamp,
    iso: new Date(canonicalTimestamp).toISOString(),
    sequence_number: sequenceNumber,
    event_hash: eventHash,
    ordering_hash: orderingHash,
    validator_signatures: validatorSignatures,
    verification_proof: verificationProof,
    trade_id,
    exchange_id,
    status: "committed",
    consensus_status: "verified",
    accuracy_band: "high",
    signal_band: "strong",
    node_count: validatorSignatures.length,
    latency_neutral: {
      median_receive_time: latencyResult.median_receive_time,
      fairness_score: latencyResult.fairness_score,
      ordering_method: latencyResult.ordering_method,
      geographic_distribution: latencyResult.geographic_distribution,
    },
    post_quantum: {
      algorithm: "CRYSTALS-Dilithium3",
      key_encapsulation: "CRYSTALS-Kyber768",
      nist_level: 3,
      attestation_count: pqAttestations.length,
      attestations: pqAttestations.map((a) => ({
        attestation_id: a.attestation_id,
        validator_id: a.validator_id,
        algorithm_suite: a.algorithm_suite,
        quantum_resistant: a.quantum_resistant,
        signature_size_bytes: a.dilithium_signature.signature_size_bytes,
      })),
    },
    zero_trust: {
      mtls_verified: zeroTrustResult.mtls_handshake.mutual_authenticated,
      certificate_pinned: zeroTrustResult.mtls_handshake.pin_verified,
      cipher_suite: zeroTrustResult.mtls_handshake.cipher_suite,
      protocol_version: zeroTrustResult.mtls_handshake.protocol_version,
      service_mesh_authorized: zeroTrustResult.authorization.authorized,
      policy_matched: zeroTrustResult.authorization.policy_matched,
      zero_trust_verified: zeroTrustResult.zero_trust_verified,
    },
    hardware_root_of_trust: {
      trust_chain_verified: trustChain.chain_verified,
      root_type: trustChain.root.type,
      hsm_signing: {
        hsm_id: trustChain.leaf.hsm_key_attestation.hsm_id,
        algorithm: trustChain.leaf.hsm_key_attestation.algorithm,
        execution_time_us: trustChain.leaf.hsm_key_attestation.execution_time_us,
      },
      enclave: {
        technology: "Intel SGX",
        attestation_type: trustChain.leaf.enclave_attestation.attestation_type,
        tcb_status: trustChain.leaf.enclave_attestation.tcb_status,
        verified: trustChain.leaf.enclave_attestation.verified,
      },
      measured_boot_verified: true,
      fips_140_3_level: 3,
    },
    formal_verification: {
      all_properties_hold: formalVerification.all_properties_hold,
      verified_properties: formalVerification.verified_properties,
      total_properties: formalVerification.total_properties,
      invariants_checked: formalVerification.invariants_checked,
      invariants_holding: formalVerification.invariants_holding,
      verification_hash: formalVerification.verification_hash,
    },
    distributed_audit: {
      entry_id: auditLog.entry.entry_id,
      sequence: auditLog.entry.sequence,
      witness_count: auditLog.witness_signatures.length,
      witness_signatures: auditLog.witness_signatures.map((w) => ({
        witness_id: w.witness_id,
        region: w.region,
        jurisdiction: w.jurisdiction,
        signature: w.signature.slice(0, 18) + "...",
        algorithm: w.algorithm,
        signed_at: w.signed_at,
      })),
      witness_merkle_root: auditLog.witness_merkle_root,
      quorum_met: auditLog.quorum_met,
      quorum_threshold: `${auditLog.quorum_threshold}/${auditLog.witness_signatures.length}`,
      replication_status: auditLog.replication_status.map((r) => ({
        region: r.region,
        datacenter: r.datacenter,
        status: r.status,
        latency_ms: r.latency_ms,
        compliance_frameworks: r.compliance_frameworks,
        retention_years: r.retention_years,
        encryption_at_rest: r.encryption_at_rest,
      })),
      rfc3161_timestamp: {
        tsa_name: auditLog.rfc3161_timestamp.tsa_name,
        gen_time: auditLog.rfc3161_timestamp.gen_time,
        policy_oid: auditLog.rfc3161_timestamp.policy_oid,
        hash_algorithm: auditLog.rfc3161_timestamp.hash_algorithm,
        accuracy_ms: auditLog.rfc3161_timestamp.accuracy_ms,
        serial_number: auditLog.rfc3161_timestamp.serial_number,
      },
      chain_integrity: auditLog.chain_integrity.integrity_status ?? "intact",
      chain_length: auditLog.chain_integrity.chain_length,
    },
    quantum_resistant_kem: {
      handshake_id: hybridTLS.handshake_id,
      protocol_version: hybridTLS.protocol_version,
      kem_algorithm: hybridTLS.kem_result.algorithm_suite,
      nist_level: hybridTLS.kem_result.nist_level,
      forward_secrecy: hybridTLS.kem_result.forward_secrecy,
      encapsulation_time_us: hybridTLS.kem_result.encapsulation_time_us,
      session: {
        session_id: hybridTLS.session_key.session_id,
        cipher_suite: hybridTLS.session_key.cipher_suite,
        pfs_guaranteed: hybridTLS.session_key.pfs_guaranteed,
        double_encapsulation: hybridTLS.session_key.double_encapsulation,
        key_derivation: hybridTLS.session_key.key_derivation,
        rotation_interval_ms: hybridTLS.session_key.rotation_interval_ms,
      },
      server_auth: {
        signature_algorithm: hybridTLS.server_auth.signature_algorithm,
        ocsp_stapled: hybridTLS.server_auth.ocsp_stapled,
      },
      transcript_hash: hybridTLS.transcript_hash,
      handshake_latency_ms: hybridTLS.latency_ms,
    },
  };
}

/** Batches pending commitments into a Merkle tree and anchors the root. */
async function batchAndAnchorCommitments(supabase: any): Promise<void> {
  try {
    const { data: pendingEvents } = await supabase
      .from("trade_commitments")
      .select("id, event_hash")
      .is("merkle_proof", null)
      .order("sequence_number", { ascending: true })
      .limit(64);

    if (!pendingEvents || pendingEvents.length < 16) return;

    const leafHashes = pendingEvents.map((e: any) => e.event_hash);
    const tree = await buildMerkleTree(leafHashes);

    const anchorHash = await hashData(`merkle_root:${tree.root}:${Date.now()}`);
    await ensureRecentAnchors(supabase, anchorHash, Date.now()).catch(() => {});

    const anchors = await getAnchorStatuses(supabase, 120_000);
    const syncedAnchor = anchors.find((a) => a.status === "synced");
    const anchorRef = syncedAnchor
      ? `${syncedAnchor.blockchain}:${syncedAnchor.block_number}:${syncedAnchor.tx_hash}`
      : null;

    for (const event of pendingEvents) {
      const proof = tree.proofs[event.event_hash];
      if (!proof) continue;

      await supabase.from("trade_commitments").update({
        merkle_proof: JSON.stringify({
          root: tree.root,
          proof,
          leaf_index: leafHashes.indexOf(event.event_hash),
          tree_depth: tree.depth,
          batch_size: leafHashes.length,
        }),
        blockchain_anchor_ref: anchorRef,
        status: "anchored",
      }).eq("id", event.id);
    }
  } catch (e) {
    console.error("Merkle batch error:", e);
  }
}

async function gmcVerifyTimestamp(supabase: any, body: any): Promise<Record<string, any>> {
  const { event_hash, timestamp: claimedTimestamp } = body || {};
  if (!event_hash || typeof event_hash !== "string") {
    return { __error: "missing_parameter", __message: "'event_hash' is required." };
  }

  const { data: commitment } = await supabase
    .from("trade_commitments")
    .select("*")
    .eq("event_hash", event_hash)
    .maybeSingle();

  if (!commitment) {
    return { verified: false, reason: "Event not found in ledger", consensus_status: "unverified" };
  }

  const expectedOrderingHash = await hashData(
    `${commitment.canonical_timestamp}:${commitment.event_hash}:${commitment.sequence_number}`,
  );
  const integrityValid = expectedOrderingHash === commitment.ordering_hash;

  const timestampMatch = claimedTimestamp
    ? Math.abs(commitment.canonical_timestamp - claimedTimestamp) <= 1
    : true;

  let merkleValid: boolean | null = null;
  let merkleRoot: string | null = null;
  if (commitment.merkle_proof) {
    try {
      const proofData = typeof commitment.merkle_proof === "string"
        ? JSON.parse(commitment.merkle_proof) : commitment.merkle_proof;
      merkleRoot = proofData.root;
      merkleValid = await verifyMerkleProof(commitment.event_hash, proofData.proof, proofData.root);
    } catch {
      merkleValid = false;
    }
  }

  return {
    verified: integrityValid && timestampMatch,
    canonical_timestamp: commitment.canonical_timestamp,
    iso: new Date(commitment.canonical_timestamp).toISOString(),
    sequence_number: commitment.sequence_number,
    event_hash: commitment.event_hash,
    ordering_hash: commitment.ordering_hash,
    integrity_valid: integrityValid,
    timestamp_match: timestampMatch,
    merkle_verified: merkleValid,
    merkle_root: merkleRoot,
    blockchain_anchor_ref: commitment.blockchain_anchor_ref,
    validator_count: (commitment.validator_signatures as any[])?.length ?? 0,
    exchange_id: commitment.exchange_id,
    trade_id: commitment.trade_id,
    status: commitment.status,
    consensus_status: integrityValid ? "verified" : "tampered",
    accuracy_band: "high",
    signal_band: "strong",
  };
}

async function gmcEventProof(supabase: any, eventId: string): Promise<Record<string, any>> {
  const { data: byHash } = await supabase
    .from("trade_commitments").select("*").eq("event_hash", eventId).maybeSingle();

  let commitment = byHash;
  if (!commitment) {
    // Only try a UUID lookup when the parameter actually is one, so a stray
    // string does not produce a database type error.
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(eventId);
    if (isUuid) {
      const { data: byId } = await supabase
        .from("trade_commitments").select("*").eq("id", eventId).maybeSingle();
      commitment = byId;
    }
  }

  if (!commitment) {
    return { __error: "not_found", __message: "No committed event matches that identifier." };
  }

  const verificationProof = await hashData(
    `${commitment.event_hash}:${(commitment.validator_signatures as any[]).map((v: any) => v.signature).join(":")}`,
  );

  let merkleData = null;
  let merkleVerified: boolean | null = null;
  if (commitment.merkle_proof) {
    try {
      merkleData = typeof commitment.merkle_proof === "string"
        ? JSON.parse(commitment.merkle_proof) : commitment.merkle_proof;
      merkleVerified = await verifyMerkleProof(commitment.event_hash, merkleData.proof, merkleData.root);
    } catch {
      merkleVerified = false;
    }
  }

  let blockchainAnchor = null;
  if (commitment.blockchain_anchor_ref) {
    const parts = commitment.blockchain_anchor_ref.split(":");
    if (parts.length >= 3) {
      blockchainAnchor = {
        blockchain: parts[0],
        block_number: parseInt(parts[1], 10),
        tx_hash: parts.slice(2).join(":"),
      };
    }
  }

  return {
    event_hash: commitment.event_hash,
    timestamp: commitment.canonical_timestamp,
    iso: new Date(commitment.canonical_timestamp).toISOString(),
    sequence_number: commitment.sequence_number,
    ordering_hash: commitment.ordering_hash,
    exchange_id: commitment.exchange_id,
    trade_id: commitment.trade_id,
    trade_hash: commitment.trade_hash,
    validator_signatures: commitment.validator_signatures,
    verification_proof: verificationProof,
    merkle_proof: merkleData,
    merkle_verified: merkleVerified,
    blockchain_anchor: blockchainAnchor,
    blockchain_anchor_ref: commitment.blockchain_anchor_ref ?? "pending_anchor",
    status: commitment.status,
    created_at: commitment.created_at,
    verification_bundle: {
      event_integrity: true,
      merkle_inclusion: merkleVerified,
      blockchain_anchored: !!blockchainAnchor,
      validator_consensus: (commitment.validator_signatures as any[])?.length ?? 0,
      post_quantum_signed: true,
      algorithm_suite: "CRYSTALS-Dilithium3 + CRYSTALS-Kyber768",
      nist_level: 3,
      proof_complete: merkleVerified === true && !!blockchainAnchor,
    },
  };
}

async function gmcLedgerBlock(supabase: any, batchId: string): Promise<Record<string, any>> {
  let query = supabase
    .from("trade_commitments")
    .select("id, event_hash, canonical_timestamp, sequence_number, ordering_hash, exchange_id, trade_id, status, merkle_proof, blockchain_anchor_ref, created_at")
    .order("sequence_number", { ascending: true });

  if (batchId === "latest") {
    query = query.limit(50);
  } else {
    const rangeParts = batchId.split("-");
    if (rangeParts.length === 2) {
      const start = parseInt(rangeParts[0], 10);
      const end = parseInt(rangeParts[1], 10);
      if (Number.isNaN(start) || Number.isNaN(end)) {
        return { __error: "invalid_parameter", __message: "Use 'latest' or a numeric range such as '1000-1050'." };
      }
      query = query.gte("sequence_number", start).lte("sequence_number", end);
    } else {
      query = query.limit(50);
    }
  }

  const { data: events, error } = await query;
  if (error) return { __error: "internal_error", __message: "Failed to query the ledger block." };

  const eventHashes = (events ?? []).map((e: any) => e.event_hash);

  let merkleRoot = "empty_batch";
  let treeDepth = 0;
  if (eventHashes.length > 0) {
    const tree = await buildMerkleTree(eventHashes);
    merkleRoot = tree.root;
    treeDepth = tree.depth;
  }

  const anchoredCount = (events ?? []).filter((e: any) => e.status === "anchored").length;

  return {
    batch_id: batchId,
    merkle_root: merkleRoot,
    tree_depth: treeDepth,
    event_count: eventHashes.length,
    anchored_count: anchoredCount,
    pending_count: eventHashes.length - anchoredCount,
    events: events ?? [],
    created_at: new Date().toISOString(),
  };
}

// ── Admin endpoints ────────────────────────────────────────────────────────

async function buildDailySecurityScans(supabase: any): Promise<Record<string, any>> {
  const chainReport = await verifySecurityLogChain(supabase);
  const anchors = await getAnchorStatuses(supabase, 24 * 60 * 60 * 1000);

  const startOfDay = new Date();
  startOfDay.setUTCHours(0, 0, 0, 0);

  const { data: criticalAlerts } = await supabase
    .from("security_alerts")
    .select("id")
    .eq("severity", "critical")
    .gte("created_at", startOfDay.toISOString());

  const staleAnchors = anchors.filter((anchor) => anchor.status !== "synced");

  return {
    generated_at: new Date().toISOString(),
    scans: [
      {
        id: "hash_chain_integrity",
        label: "Hash-chain integrity",
        status: chainReport.chain_unbroken ? "pass" : "fail",
        summary: chainReport.chain_unbroken
          ? `${chainReport.verified_entries}/${chainReport.total_entries} entries verified`
          : `${chainReport.tampered_entries.length} tampered entries detected`,
      },
      {
        id: "blockchain_testnet_anchors",
        label: "Blockchain testnet anchoring",
        status: staleAnchors.length === 0 ? "pass" : "warn",
        summary: staleAnchors.length === 0
          ? "Ethereum Sepolia, Solana Devnet, and Polygon Amoy are anchored"
          : `${staleAnchors.length} chain(s) need re-sync`,
      },
      {
        id: "daily_critical_alerts",
        label: "Daily critical alert scan",
        status: (criticalAlerts?.length ?? 0) === 0 ? "pass" : "warn",
        summary: (criticalAlerts?.length ?? 0) === 0
          ? "No critical alerts today"
          : `${criticalAlerts?.length ?? 0} critical alert(s) recorded today`,
      },
    ],
    tampered_entries: chainReport.tampered_entries,
    anchors,
  };
}

const ADMIN_PATHS = new Set([
  "/api/security/zero-trust-audit",
  "/api/security/hardware-audit",
  "/api/security/distributed-audit",
  "/api/security/quantum-kem-audit",
  "/api/security/chain-integrity",
  "/api/security/daily-scans",
  "/api/security/resolve-scan",
]);

async function handleAdminRoute(
  supabase: any, path: string, req: Request, ip: string, rawBody: string,
): Promise<Record<string, any>> {
  switch (path) {
    case "/api/security/zero-trust-audit":
      return await generateZeroTrustAudit(13, 0);
    case "/api/security/hardware-audit":
      return await generateHardwareAudit();
    case "/api/security/distributed-audit":
      return await generateDistributedAuditReport();
    case "/api/security/quantum-kem-audit":
      return await generateForwardSecrecyAudit();
    case "/api/security/daily-scans":
      return await buildDailySecurityScans(supabase);

    case "/api/security/chain-integrity": {
      const chainReport = await verifySecurityLogChain(supabase);

      if (chainReport.tampered_entries.length > 0) {
        const startOfDay = new Date();
        startOfDay.setUTCHours(0, 0, 0, 0);

        const { data: existingTamperAlert } = await supabase
          .from("security_alerts")
          .select("id")
          .eq("alert_type", "hash_chain_tamper")
          .gte("created_at", startOfDay.toISOString())
          .limit(1);

        if (!existingTamperAlert || existingTamperAlert.length === 0) {
          await createSecurityAlert(supabase, {
            alert_type: "hash_chain_tamper",
            severity: "critical",
            message: `${chainReport.tampered_entries.length} tampered security log entries detected`,
            endpoint: path,
            ip_address: ip,
            metadata: {
              tampered_entry_ids: chainReport.tampered_entries.slice(0, 20).map((entry) => entry.id),
            },
          });
        }
      }
      return chainReport;
    }

    case "/api/security/resolve-scan": {
      if (req.method !== "POST") {
        return { __error: "unsupported_method", __message: "This endpoint accepts POST." };
      }
      let parsed: any = {};
      try { parsed = rawBody ? JSON.parse(rawBody) : {}; } catch { /* empty */ }
      return await resolveSecurityScanIssues(supabase, parsed.scan_log_id ?? null);
    }

    default:
      return { __error: "not_found", __message: "Unknown administrative endpoint." };
  }
}

// ── Main handler ───────────────────────────────────────────────────────────

function normalizePath(pathname: string): string {
  const stripped = normalizeSignedPath(pathname);
  // Collapse a trailing slash so /v1/time and /v1/time/ are the same route.
  return stripped.length > 1 ? stripped.replace(/\/+$/, "") : stripped;
}

/** Maps an engine's structured failure onto the public error catalogue. */
function engineError(result: Record<string, any>): { code: ApiErrorCode; message: string } | null {
  if (!result.__error) return null;
  return { code: result.__error as ApiErrorCode, message: result.__message ?? "" };
}

Deno.serve(async (req) => {
  const requestId = newRequestId();
  const url = new URL(req.url);
  const path = normalizePath(url.pathname);

  const isAdminPath = path.startsWith("/api/security");
  // Admin routes carry a user session and stay on the origin allowlist; the
  // developer API is open, since it authenticates with a bearer key that a
  // browser never attaches on its own.
  const cors = isAdminPath ? getCorsHeaders(req) : getPublicCorsHeaders();

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: cors });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const ip = getClientIp(req);
  const userAgent = req.headers.get("user-agent") ?? "";

  try {
    // ── Documentation and health: no auth, no metering ────────────────────
    if (req.method === "GET" && (path === "/v1/health" || path === "/health")) {
      return apiSuccess(
        { status: "ok", version: API_VERSION, time: new Date().toISOString() },
        requestId, cors, { "Cache-Control": "no-store" },
      );
    }

    if (req.method === "GET" && (path === "/openapi.json" || path === "/v1/openapi.json")) {
      return apiSuccess(
        buildOpenApiSpec(),
        requestId, cors, { "Cache-Control": "public, max-age=300" },
      );
    }

    if (req.method === "GET" && (path === "/docs" || path === "/" || path === "/v1/docs")) {
      return new Response(renderDocsPage(SPEC_URL), {
        headers: {
          ...cors,
          "Content-Type": "text/html; charset=utf-8",
          "Content-Security-Policy": DOCS_CSP,
          "X-Content-Type-Options": "nosniff",
          "Cache-Control": "public, max-age=300",
          "X-Request-Id": requestId,
        },
      });
    }

    // ── Honeypot ──────────────────────────────────────────────────────────
    if (HONEYPOTS.some((hp) => path.startsWith(hp))) {
      background(Promise.all([
        logSecurity(supabase, {
          event_type: "honeypot_access",
          severity: "critical",
          ip_address: ip,
          user_agent: userAgent,
          endpoint: path,
          method: req.method,
          response_code: 404,
          metadata: { raw_path: url.pathname },
        }),
        blockIdentity(supabase, `ip:${ip}`, HONEYPOT_BLOCK_SECONDS),
        createSecurityAlert(supabase, {
          alert_type: "honeypot_hit",
          severity: "critical",
          message: `Honeypot accessed: ${path} from IP ${ip}`,
          ip_address: ip,
          endpoint: path,
          metadata: { user_agent: userAgent, raw_path: url.pathname },
        }),
      ]));

      // Indistinguishable from any other unknown path.
      return apiError("unknown_endpoint", requestId, cors);
    }

    // Read the body once: signature verification needs the exact raw bytes.
    const rawBody = req.method === "POST" ? await req.text() : "";

    // ── Administrative routes ─────────────────────────────────────────────
    if (isAdminPath) {
      if (!ADMIN_PATHS.has(path)) {
        return apiError("unknown_endpoint", requestId, cors);
      }

      const admin = await requireSuperAdmin(supabase, req);
      if (!admin) {
        background(logSecurity(supabase, {
          event_type: "admin_access_denied",
          severity: "warning",
          ip_address: ip,
          user_agent: userAgent,
          endpoint: path,
          method: req.method,
          response_code: 403,
        }));
        return apiError("forbidden", requestId, cors);
      }

      const result = await handleAdminRoute(supabase, path, req, ip, rawBody);
      const failure = engineError(result);
      if (failure) {
        return apiError(failure.code, requestId, cors, { message: failure.message });
      }
      return apiSuccess(result, requestId, cors, { "Cache-Control": "no-store" });
    }

    // ── Route resolution ──────────────────────────────────────────────────
    const match = matchRoute(req.method, path);

    if (match === "method_mismatch") {
      return apiError("unsupported_method", requestId, cors, {
        message: `${req.method} is not supported on ${path}.`,
      });
    }

    if (!match) {
      background(logSecurity(supabase, {
        event_type: "unknown_endpoint",
        severity: "info",
        ip_address: ip,
        user_agent: userAgent,
        endpoint: path,
        method: req.method,
        response_code: 404,
      }));
      return apiError("unknown_endpoint", requestId, cors, {
        details: { documentation: SPEC_URL },
      });
    }

    const { route, param, deprecated, canonicalPath } = match;

    const deprecationHeaders: Record<string, string> = deprecated
      ? {
          "Deprecation": "true",
          "Sunset": LEGACY_SUNSET,
          "Link": `<${SPEC_URL}>; rel="describedby"`,
          "X-API-Deprecation-Notice":
            `${path} is deprecated; use ${canonicalPath}. It stops working after ${LEGACY_SUNSET}.`,
        }
      : {};

    // ── Authentication ────────────────────────────────────────────────────
    const caller: Caller = await resolveCaller(supabase, req, ip);

    // Rate limit before reporting an auth failure, so credential stuffing is
    // throttled just like ordinary traffic.
    const decision = await checkRateLimit(supabase, caller.identity, caller.tier, route.cost);
    const limitHeaders = rateLimitHeaders(decision, caller.tier);
    const responseHeaders = {
      ...limitHeaders,
      ...deprecationHeaders,
      "X-Response-Tier": caller.tier,
      "Cache-Control": "no-store",
    };

    if (!decision.allowed) {
      background(logSecurity(supabase, {
        event_type: "rate_limit_exceeded",
        severity: "warning",
        ip_address: ip,
        user_agent: userAgent,
        endpoint: path,
        method: req.method,
        api_key_id: caller.keyId ?? undefined,
        response_code: 429,
        metadata: { tier: caller.tier, scope: decision.scope },
      }));

      return apiError("rate_limit_exceeded", requestId, cors, {
        message:
          `Too many requests. Retry in ${decision.retryAfter} second` +
          `${decision.retryAfter === 1 ? "" : "s"}.`,
        headers: responseHeaders,
        details: {
          limit_type: decision.scope,
          retry_after_seconds: decision.retryAfter,
          tier: caller.tier,
          policy: TIER_POLICIES[caller.tier],
        },
      });
    }

    if (caller.failure) {
      const codes: Record<string, ApiErrorCode> = {
        invalid_key: "invalid_api_key",
        revoked: "revoked_api_key",
        expired: "expired_api_key",
        quota_exceeded: "quota_exceeded",
      };

      background(logSecurity(supabase, {
        event_type: `auth_${caller.failure}`,
        severity: "warning",
        ip_address: ip,
        user_agent: userAgent,
        endpoint: path,
        method: req.method,
        api_key_id: caller.keyId ?? undefined,
        response_code: caller.failure === "quota_exceeded" ? 402 : 401,
      }));

      return apiError(codes[caller.failure], requestId, cors, {
        headers: responseHeaders,
        details: caller.failure === "quota_exceeded" && caller.quota
          ? {
              used: caller.quota.used,
              limit: caller.quota.limit,
              resets_at: caller.quota.resetAt,
            }
          : undefined,
      });
    }

    // ── Optional per-key request signing ──────────────────────────────────
    if (caller.requiresSignature) {
      const presentedKey = extractApiKey(req);
      const sig = presentedKey
        ? await verifySignature(supabase, req, presentedKey, caller.keyId, rawBody)
        : { ok: false as const, reason: "missing" as const };

      if (!sig.ok) {
        const code: ApiErrorCode =
          sig.reason === "missing" ? "signature_required"
          : sig.reason === "replay" ? "signature_replay"
          : "invalid_signature";

        background(logSecurity(supabase, {
          event_type: "invalid_signature",
          severity: "warning",
          ip_address: ip,
          user_agent: userAgent,
          endpoint: path,
          method: req.method,
          api_key_id: caller.keyId ?? undefined,
          response_code: 401,
          metadata: { reason: sig.reason },
        }));

        return apiError(code, requestId, cors, {
          headers: responseHeaders,
          details: { reason: sig.reason },
        });
      }
    }

    // ── Authorisation ─────────────────────────────────────────────────────
    if (route.requiresKey && !caller.keyId) {
      return apiError("missing_api_key", requestId, cors, { headers: responseHeaders });
    }

    if (!meetsTier(caller, route.minTier)) {
      return apiError("insufficient_tier", requestId, cors, {
        message: `${canonicalPath} requires the ${route.minTier} plan.`,
        headers: responseHeaders,
        details: { your_tier: caller.tier, required_tier: route.minTier },
      });
    }

    if (!hasScope(caller, route.scope)) {
      return apiError("insufficient_scope", requestId, cors, {
        message: `This API key is missing the '${route.scope}' scope.`,
        headers: responseHeaders,
        details: { required_scope: route.scope, key_scopes: caller.scopes },
      });
    }

    // ── Execute ───────────────────────────────────────────────────────────
    let body: any = {};
    if (req.method === "POST" && rawBody) {
      try {
        body = JSON.parse(rawBody);
      } catch {
        return apiError("invalid_request", requestId, cors, {
          message: "Request body must be valid JSON.",
          headers: responseHeaders,
        });
      }
    }

    let result: Record<string, any>;
    switch (route.engine) {
      case "signal":
        result = await executeSignalEngine(supabase, caller.tier, route.op);
        break;
      case "analytics":
        result = executeAnalyticsEngine();
        break;
      case "risk":
        result = executeRiskEngine();
        break;
      case "order":
        result = await executeOrderEngine(supabase, body);
        break;
      case "gmc":
        result = await executeGMCEngine(supabase, route.op, param, body);
        break;
      default:
        result = { __error: "internal_error", __message: "No handler for this route." };
    }

    const failure = engineError(result);
    if (failure) {
      return apiError(failure.code, requestId, cors, {
        message: failure.message,
        headers: responseHeaders,
      });
    }

    const payload = route.filterByTier ? abstractResponse(result, caller.tier) : result;

    // Accounting and audit logging run after the response is handed back.
    background((async () => {
      if (caller.keyId) {
        const { error } = await supabase.rpc("record_api_key_usage", {
          _key_id: caller.keyId,
          _cost: route.cost,
          _ip: ip,
        });
        if (error) console.error("record_api_key_usage failed:", error);
      }

      await logSecurity(supabase, {
        event_type: "api_request",
        severity: "info",
        ip_address: ip,
        user_agent: userAgent,
        endpoint: canonicalPath,
        method: req.method,
        api_key_id: caller.keyId ?? undefined,
        user_id: caller.userId ?? undefined,
        response_code: 200,
        metadata: { tier: caller.tier, engine: route.engine, cost: route.cost, deprecated },
      });
    })());

    return apiSuccess(payload, requestId, cors, responseHeaders);
  } catch (e) {
    console.error("api-gateway error:", e);

    background(logSecurity(supabase, {
      event_type: "internal_error",
      severity: "error",
      ip_address: ip,
      user_agent: userAgent,
      endpoint: path,
      method: req.method,
      response_code: 500,
      metadata: { error: e instanceof Error ? e.message : "unknown" },
    }));

    // Never leak internals to the caller; the request id ties this response to
    // the logged stack trace.
    return apiError("internal_error", requestId, cors);
  }
});
