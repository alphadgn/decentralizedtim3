CREATE SEQUENCE IF NOT EXISTS public.security_log_chain_seq;

ALTER TABLE public.security_logs
  ADD COLUMN IF NOT EXISTS chain_index bigint DEFAULT nextval('public.security_log_chain_seq'),
  ADD COLUMN IF NOT EXISTS previous_hash text,
  ADD COLUMN IF NOT EXISTS current_hash text;

WITH ordered AS (
  SELECT id, row_number() OVER (ORDER BY created_at, id) AS seq_num
  FROM public.security_logs WHERE chain_index IS NULL
)
UPDATE public.security_logs s SET chain_index = ordered.seq_num FROM ordered WHERE s.id = ordered.id;

SELECT setval('public.security_log_chain_seq', GREATEST((SELECT COALESCE(MAX(chain_index), 0) FROM public.security_logs), 1), true);

CREATE OR REPLACE FUNCTION public.compute_security_log_hash(
  p_chain_index bigint,
  p_created_at timestamptz,
  p_event_type text,
  p_severity text,
  p_endpoint text,
  p_method text,
  p_response_code integer,
  p_user_id uuid,
  p_api_key_id uuid,
  p_ip_address text,
  p_metadata jsonb,
  p_previous_hash text
)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT encode(
    extensions.digest(
      concat_ws(
        '|',
        COALESCE(p_chain_index::text, ''),
        COALESCE(to_char(p_created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'), ''),
        COALESCE(p_event_type, ''),
        COALESCE(p_severity, ''),
        COALESCE(p_endpoint, ''),
        COALESCE(p_method, ''),
        COALESCE(p_response_code::text, ''),
        COALESCE(p_user_id::text, ''),
        COALESCE(p_api_key_id::text, ''),
        COALESCE(p_ip_address, ''),
        COALESCE(p_metadata::text, '{}'),
        COALESCE(p_previous_hash, '')
      )::bytea,
      'sha256'
    ),
    'hex'
  );
$$;

WITH RECURSIVE ordered AS (
  SELECT id, chain_index, created_at, event_type, severity, endpoint, method,
         response_code, user_id, api_key_id, ip_address, metadata,
         row_number() OVER (ORDER BY chain_index ASC, created_at ASC, id ASC) AS rn
  FROM public.security_logs
),
chain AS (
  SELECT o.id, o.rn, NULL::text AS prev_h,
    public.compute_security_log_hash(o.chain_index, o.created_at, o.event_type, o.severity,
      o.endpoint, o.method, o.response_code, o.user_id, o.api_key_id, o.ip_address, o.metadata, NULL) AS cur_h
  FROM ordered o WHERE o.rn = 1
  UNION ALL
  SELECT o.id, o.rn, c.cur_h,
    public.compute_security_log_hash(o.chain_index, o.created_at, o.event_type, o.severity,
      o.endpoint, o.method, o.response_code, o.user_id, o.api_key_id, o.ip_address, o.metadata, c.cur_h)
  FROM ordered o JOIN chain c ON o.rn = c.rn + 1
)
UPDATE public.security_logs s SET previous_hash = chain.prev_h, current_hash = chain.cur_h FROM chain WHERE s.id = chain.id;

ALTER TABLE public.security_logs ALTER COLUMN chain_index SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS security_logs_chain_index_uidx ON public.security_logs (chain_index);

CREATE OR REPLACE FUNCTION public.security_logs_apply_hash_chain()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_previous_hash text;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('security_logs_hash_chain'));
  IF NEW.created_at IS NULL THEN NEW.created_at := now(); END IF;
  IF NEW.chain_index IS NULL THEN NEW.chain_index := nextval('public.security_log_chain_seq'); END IF;
  SELECT current_hash INTO v_previous_hash FROM public.security_logs ORDER BY chain_index DESC LIMIT 1;
  NEW.previous_hash := v_previous_hash;
  NEW.current_hash := public.compute_security_log_hash(
    NEW.chain_index, NEW.created_at, NEW.event_type, NEW.severity,
    NEW.endpoint, NEW.method, NEW.response_code, NEW.user_id,
    NEW.api_key_id, NEW.ip_address, NEW.metadata, v_previous_hash
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_security_logs_hash_chain ON public.security_logs;
CREATE TRIGGER trg_security_logs_hash_chain
  BEFORE INSERT ON public.security_logs
  FOR EACH ROW EXECUTE FUNCTION public.security_logs_apply_hash_chain();