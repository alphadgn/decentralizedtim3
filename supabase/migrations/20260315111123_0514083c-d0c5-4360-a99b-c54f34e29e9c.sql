-- Fix Privy identity model: remove FK constraints that block deterministic UUID inserts
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_user_id_fkey;
ALTER TABLE public.user_roles DROP CONSTRAINT IF EXISTS user_roles_user_id_fkey;

-- Hourly chain-integrity scan function
CREATE OR REPLACE FUNCTION public.run_hourly_chain_integrity_scan()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_tampered_count integer := 0;
  v_tampered_ids uuid[] := ARRAY[]::uuid[];
  v_alert_created boolean := false;
BEGIN
  WITH ordered AS (
    SELECT
      l.id,
      l.chain_index,
      l.created_at,
      l.event_type,
      l.severity,
      l.endpoint,
      l.method,
      l.response_code,
      l.user_id,
      l.api_key_id,
      l.ip_address,
      COALESCE(l.metadata, '{}'::jsonb) AS metadata,
      l.previous_hash,
      l.current_hash,
      LAG(l.current_hash) OVER (ORDER BY l.chain_index ASC) AS expected_previous_hash
    FROM public.security_logs l
  ),
  checked AS (
    SELECT
      o.id,
      o.chain_index,
      o.expected_previous_hash,
      o.previous_hash AS actual_previous_hash,
      public.compute_security_log_hash(
        o.chain_index, o.created_at, o.event_type, o.severity,
        o.endpoint, o.method, o.response_code, o.user_id,
        o.api_key_id, o.ip_address, o.metadata, o.previous_hash
      ) AS expected_current_hash,
      o.current_hash AS actual_current_hash
    FROM ordered o
  ),
  tampered AS (
    SELECT c.id, c.chain_index
    FROM checked c
    WHERE COALESCE(c.actual_previous_hash, '') <> COALESCE(c.expected_previous_hash, '')
       OR COALESCE(c.actual_current_hash, '') <> COALESCE(c.expected_current_hash, '')
  )
  SELECT
    COUNT(*)::int,
    COALESCE(ARRAY_AGG(t.id ORDER BY t.chain_index), ARRAY[]::uuid[])
  INTO v_tampered_count, v_tampered_ids
  FROM tampered t;

  IF v_tampered_count > 0 THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.security_alerts
      WHERE alert_type = 'hash_chain_tamper'
        AND severity = 'critical'
        AND created_at >= NOW() - INTERVAL '1 hour'
    ) THEN
      INSERT INTO public.security_alerts (
        alert_type, severity, message, endpoint, metadata
      ) VALUES (
        'hash_chain_tamper', 'critical',
        format('%s tampered security log entries detected by hourly integrity scan', v_tampered_count),
        '/api/security/chain-integrity',
        jsonb_build_object(
          'source', 'hourly_chain_integrity_cron',
          'tampered_entry_ids', to_jsonb(v_tampered_ids[1:20]),
          'tampered_count', v_tampered_count
        )
      );
      v_alert_created := true;
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'checked_at', NOW(),
    'tampered_count', v_tampered_count,
    'alert_created', v_alert_created,
    'tampered_entry_ids', to_jsonb(v_tampered_ids[1:20])
  );
END;
$fn$;