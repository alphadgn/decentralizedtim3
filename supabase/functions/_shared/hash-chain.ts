export interface TamperedEntry {
  id: string;
  chain_index: number;
  created_at: string;
  event_type: string;
  expected_previous_hash: string | null;
  actual_previous_hash: string | null;
  expected_current_hash: string | null;
  actual_current_hash: string | null;
  reasons: string[];
}

export interface ChainIntegrityReport {
  chain_unbroken: boolean;
  total_entries: number;
  verified_entries: number;
  tampered_entries: TamperedEntry[];
  checked_at: string;
}

interface SecurityLogRow {
  id: string;
  chain_index: number;
  created_at: string;
  event_type: string;
  severity: string;
  endpoint: string | null;
  method: string | null;
  response_code: number | null;
  user_id: string | null;
  api_key_id: string | null;
  ip_address: string | null;
  metadata: Record<string, unknown> | null;
  previous_hash: string | null;
  current_hash: string | null;
}

export async function verifySecurityLogChain(supabase: any): Promise<ChainIntegrityReport> {
  const { data, error } = await supabase
    .from("security_logs")
    .select(
      "id, chain_index, created_at, event_type, severity, endpoint, method, response_code, user_id, api_key_id, ip_address, metadata, previous_hash, current_hash",
    )
    .order("chain_index", { ascending: true });

  if (error) {
    throw error;
  }

  const logs: SecurityLogRow[] = data ?? [];

  if (logs.length === 0) {
    return {
      chain_unbroken: true,
      total_entries: 0,
      verified_entries: 0,
      tampered_entries: [],
      checked_at: new Date().toISOString(),
    };
  }

  const computedHashes = await Promise.all(
    logs.map(async (log) => {
      const { data: computedHash } = await supabase.rpc("compute_security_log_hash", {
        p_chain_index: log.chain_index,
        p_created_at: log.created_at,
        p_event_type: log.event_type,
        p_severity: log.severity,
        p_endpoint: log.endpoint,
        p_method: log.method,
        p_response_code: log.response_code,
        p_user_id: log.user_id,
        p_api_key_id: log.api_key_id,
        p_ip_address: log.ip_address,
        p_metadata: log.metadata ?? {},
        p_previous_hash: log.previous_hash,
      });

      return computedHash as string | null;
    }),
  );

  const tamperedEntries: TamperedEntry[] = [];

  logs.forEach((log, index) => {
    const expectedPrevious = index === 0 ? null : logs[index - 1].current_hash ?? null;
    const expectedCurrent = computedHashes[index] ?? null;

    const reasons: string[] = [];

    if ((log.previous_hash ?? null) !== expectedPrevious) {
      reasons.push("previous_hash_mismatch");
    }

    if (!expectedCurrent || expectedCurrent !== log.current_hash) {
      reasons.push("current_hash_mismatch");
    }

    if (reasons.length > 0) {
      tamperedEntries.push({
        id: log.id,
        chain_index: log.chain_index,
        created_at: log.created_at,
        event_type: log.event_type,
        expected_previous_hash: expectedPrevious,
        actual_previous_hash: log.previous_hash,
        expected_current_hash: expectedCurrent,
        actual_current_hash: log.current_hash,
        reasons,
      });
    }
  });

  return {
    chain_unbroken: tamperedEntries.length === 0,
    total_entries: logs.length,
    verified_entries: logs.length - tamperedEntries.length,
    tampered_entries: tamperedEntries,
    checked_at: new Date().toISOString(),
  };
}
