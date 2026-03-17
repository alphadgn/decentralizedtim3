export type DailyScanStatus = "pass" | "warn" | "fail";

export type SecurityScanCheck = {
  id: string;
  label: string;
  status: DailyScanStatus;
  summary: string;
};

export type SecurityScanResolution = {
  attempted_at?: string;
  actions?: Array<Record<string, unknown>>;
  unresolved_checks?: string[];
};

export type SecurityScanMetadata = {
  scan_id?: string;
  source?: string;
  scans: SecurityScanCheck[];
  resolution?: SecurityScanResolution;
};

export type PersistedSecurityScan = {
  id: string;
  ran_at: string;
  source: string;
  scans: SecurityScanCheck[];
  resolution?: SecurityScanResolution;
};

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function normalizeStatus(value: unknown): DailyScanStatus {
  if (value === "pass" || value === "warn" || value === "fail") return value;
  return "warn";
}

export function parseSecurityScanMetadata(metadata: unknown): SecurityScanMetadata | null {
  if (!isObject(metadata) || !Array.isArray(metadata.scans)) return null;

  const scans = metadata.scans
    .filter((scan) => isObject(scan))
    .map((scan) => ({
      id: String(scan.id ?? "unknown_check"),
      label: String(scan.label ?? "Unnamed check"),
      status: normalizeStatus(scan.status),
      summary: String(scan.summary ?? "No summary available"),
    }));

  if (scans.length === 0) return null;

  const resolution = isObject(metadata.resolution)
    ? {
        attempted_at:
          typeof metadata.resolution.attempted_at === "string"
            ? metadata.resolution.attempted_at
            : undefined,
        actions: Array.isArray(metadata.resolution.actions)
          ? (metadata.resolution.actions as Array<Record<string, unknown>>)
          : undefined,
        unresolved_checks: Array.isArray(metadata.resolution.unresolved_checks)
          ? metadata.resolution.unresolved_checks.map((item) => String(item))
          : undefined,
      }
    : undefined;

  return {
    scan_id: typeof metadata.scan_id === "string" ? metadata.scan_id : undefined,
    source: typeof metadata.source === "string" ? metadata.source : undefined,
    scans,
    resolution,
  };
}

export function parseSecurityScanRow(row: {
  id: string;
  created_at: string;
  metadata: unknown;
}): PersistedSecurityScan | null {
  const parsed = parseSecurityScanMetadata(row.metadata);
  if (!parsed) return null;

  return {
    id: row.id,
    ran_at: row.created_at,
    source: parsed.source ?? "unknown",
    scans: parsed.scans,
    resolution: parsed.resolution,
  };
}

export function scanHasFailures(scan: PersistedSecurityScan): boolean {
  return scan.scans.some((check) => check.status === "fail");
}
