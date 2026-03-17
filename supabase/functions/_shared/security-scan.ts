import { verifySecurityLogChain } from "./hash-chain.ts";
import { ensureRecentAnchors, getAnchorStatuses } from "./blockchain-anchors.ts";

export type DailyScanStatus = "pass" | "warn" | "fail";

export interface SecurityScanCheck {
  id: string;
  label: string;
  status: DailyScanStatus;
  summary: string;
}

export interface DailyScansResponse {
  generated_at: string;
  scans: SecurityScanCheck[];
}

export interface PersistedSecurityScan {
  id: string;
  ran_at: string;
  source: string;
  scans: SecurityScanCheck[];
  resolution?: Record<string, unknown>;
}

function nowIso() {
  return new Date().toISOString();
}

function toSeverity(scans: SecurityScanCheck[]): "info" | "warning" | "critical" {
  if (scans.some((scan) => scan.status === "fail")) return "critical";
  if (scans.some((scan) => scan.status === "warn")) return "warning";
  return "info";
}

function toResponseCode(scans: SecurityScanCheck[]): number {
  if (scans.some((scan) => scan.status === "fail")) return 500;
  if (scans.some((scan) => scan.status === "warn")) return 206;
  return 200;
}

function toEndpointSummary(scans: SecurityScanCheck[]): string {
  const failed = scans.filter((scan) => scan.status === "fail").length;
  const warned = scans.filter((scan) => scan.status === "warn").length;

  if (failed > 0) return `${failed} failed check(s), ${warned} warning(s)`;
  if (warned > 0) return `${warned} warning check(s), no failures`;
  return "All checks passed";
}

async function sha256Hex(data: string): Promise<string> {
  const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(data));
  return Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function asRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

export async function buildDailySecurityScanSnapshot(supabase: any): Promise<DailyScansResponse> {
  const chainReport = await verifySecurityLogChain(supabase);
  const anchors = await getAnchorStatuses(supabase, 24 * 60 * 60 * 1000);

  const startOfDay = new Date();
  startOfDay.setUTCHours(0, 0, 0, 0);

  const { data: criticalAlerts } = await supabase
    .from("security_alerts")
    .select("id")
    .eq("severity", "critical")
    .eq("acknowledged", false)
    .gte("created_at", startOfDay.toISOString());

  const staleAnchors = anchors.filter((anchor: any) => anchor.status !== "synced");

  return {
    generated_at: nowIso(),
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
        summary:
          staleAnchors.length === 0
            ? "Ethereum Sepolia, Solana Devnet, and Polygon Amoy are anchored"
            : `${staleAnchors.length} chain(s) need re-sync`,
      },
      {
        id: "daily_critical_alerts",
        label: "Daily critical alert scan",
        status: (criticalAlerts?.length ?? 0) === 0 ? "pass" : "warn",
        summary:
          (criticalAlerts?.length ?? 0) === 0
            ? "No unacknowledged critical alerts in current UTC day"
            : `${criticalAlerts?.length ?? 0} critical alert(s) currently open`,
      },
    ],
  };
}

export async function persistSecurityScanResult(
  supabase: any,
  options: {
    source: "scheduled" | "manual" | "resolve";
    triggered_by?: string | null;
    resolution?: Record<string, unknown>;
  },
): Promise<PersistedSecurityScan> {
  const snapshot = await buildDailySecurityScanSnapshot(supabase);
  const scanId = crypto.randomUUID();

  const metadata: Record<string, unknown> = {
    scan_id: scanId,
    source: options.source,
    scans: snapshot.scans,
    generated_at: snapshot.generated_at,
  };

  if (options.triggered_by) {
    metadata.triggered_by = options.triggered_by;
  }

  if (options.resolution) {
    metadata.resolution = options.resolution;
  }

  const { data, error } = await supabase
    .from("security_logs")
    .insert({
      event_type: "automated_security_scan",
      severity: toSeverity(snapshot.scans),
      endpoint: toEndpointSummary(snapshot.scans),
      method: options.source.toUpperCase(),
      response_code: toResponseCode(snapshot.scans),
      metadata,
      ip_address: "system",
      user_agent: `security-scan:${options.source}`,
    })
    .select("id, created_at, metadata")
    .single();

  if (error) throw error;

  const persistedMetadata = asRecord(data?.metadata);

  return {
    id: data.id,
    ran_at: data.created_at,
    source: String(persistedMetadata.source ?? options.source),
    scans: Array.isArray(persistedMetadata.scans)
      ? (persistedMetadata.scans as SecurityScanCheck[])
      : snapshot.scans,
    resolution: asRecord(persistedMetadata.resolution),
  };
}

export async function resolveSecurityScanIssues(
  supabase: any,
  scanLogId?: string,
): Promise<{
  actions: Array<Record<string, unknown>>;
  unresolved_checks: string[];
  rescanned: PersistedSecurityScan;
}> {
  let requestedChecks: string[] = [];
  let originalMetadata: Record<string, unknown> = {};

  if (scanLogId) {
    const { data: scanLog } = await supabase
      .from("security_logs")
      .select("id, metadata")
      .eq("id", scanLogId)
      .eq("event_type", "automated_security_scan")
      .maybeSingle();

    originalMetadata = asRecord(scanLog?.metadata);

    if (Array.isArray(originalMetadata.scans)) {
      requestedChecks = originalMetadata.scans
        .filter((scan) => typeof scan?.status === "string" && scan.status !== "pass")
        .map((scan) => String(scan.id));
    }
  }

  const actions: Array<Record<string, unknown>> = [];
  const unresolvedChecks: string[] = [];

  if (requestedChecks.includes("blockchain_testnet_anchors")) {
    const seed = await sha256Hex(`resolve-anchors:${Date.now()}`);
    await ensureRecentAnchors(supabase, seed, Date.now());
    actions.push({
      check_id: "blockchain_testnet_anchors",
      action: "anchor_refresh_requested",
      status: "completed",
    });
  }

  if (requestedChecks.includes("daily_critical_alerts")) {
    const { data: openCritical } = await supabase
      .from("security_alerts")
      .select("id")
      .eq("severity", "critical")
      .eq("acknowledged", false)
      .limit(500);

    const alertIds = (openCritical ?? []).map((alert: any) => alert.id);
    if (alertIds.length > 0) {
      await supabase
        .from("security_alerts")
        .update({ acknowledged: true })
        .in("id", alertIds);
    }

    actions.push({
      check_id: "daily_critical_alerts",
      action: "critical_alerts_acknowledged",
      acknowledged_count: alertIds.length,
      status: "completed",
    });
  }

  if (requestedChecks.includes("hash_chain_integrity")) {
    unresolvedChecks.push("hash_chain_integrity");
    actions.push({
      check_id: "hash_chain_integrity",
      action: "manual_forensic_review_required",
      status: "requires_manual_action",
      reason: "Tampered hash chain entries are immutable and cannot be auto-repaired safely.",
    });
  }

  const resolutionSummary = {
    attempted_at: nowIso(),
    actions,
    unresolved_checks: unresolvedChecks,
  };

  if (scanLogId) {
    await supabase
      .from("security_logs")
      .update({
        metadata: {
          ...originalMetadata,
          resolution: resolutionSummary,
        },
      })
      .eq("id", scanLogId)
      .eq("event_type", "automated_security_scan");
  }

  const rescanned = await persistSecurityScanResult(supabase, {
    source: "resolve",
    triggered_by: scanLogId ?? "manual",
    resolution: {
      ...resolutionSummary,
      resolved_scan_id: scanLogId,
    },
  });

  return {
    actions,
    unresolved_checks: unresolvedChecks,
    rescanned,
  };
}
