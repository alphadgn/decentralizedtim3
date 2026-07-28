-- ============================================================================
-- Public API hardening
--
-- Prepares the gateway to be consumed by third-party developers:
--   * atomic (race-free) rate limiting, keyed by API key or IP
--   * API key auth that actually honours revocation, expiry and quota
--   * replay protection for signed requests
--   * a verified Privy-subject -> app-user mapping for admin routes
--
-- All helper functions are SECURITY DEFINER and are locked down to the
-- service_role: they are called only by edge functions, never by clients.
-- ============================================================================

-- ── 1. API key metadata ────────────────────────────────────────────────────

ALTER TABLE public.api_keys
  ADD COLUMN IF NOT EXISTS scopes text[],
  ADD COLUMN IF NOT EXISTS requires_signature boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS quota_period_start timestamptz NOT NULL DEFAULT date_trunc('month', now()),
  ADD COLUMN IF NOT EXISTS daily_period_start timestamptz NOT NULL DEFAULT date_trunc('day', now()),
  ADD COLUMN IF NOT EXISTS last_used_ip text;

-- NULL scopes means "every scope this tier is entitled to" so that keys
-- issued before scoping existed keep working unchanged.
COMMENT ON COLUMN public.api_keys.scopes IS
  'Explicit scope grants. NULL = all scopes available to the key''s tier.';
COMMENT ON COLUMN public.api_keys.requires_signature IS
  'When true the key must send X-Signature/X-Timestamp/X-Nonce on every request.';

CREATE INDEX IF NOT EXISTS idx_api_keys_user_active
  ON public.api_keys (user_id) WHERE revoked_at IS NULL;

-- ── 2. Rate limit buckets ──────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.rate_limit_buckets (
  bucket_key    text PRIMARY KEY,
  window_start  timestamptz NOT NULL DEFAULT now(),
  request_count integer     NOT NULL DEFAULT 0,
  blocked_until timestamptz,
  updated_at    timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.rate_limit_buckets ENABLE ROW LEVEL SECURITY;

-- Mirrors the two policies ip_rate_limits carried: the security dashboard admits
-- super admins and auditors alike, so an auditor-only session must still be able
-- to read the bucket rows or the blocked-callers table silently renders empty.
CREATE POLICY "Super admins can view rate limit buckets"
  ON public.rate_limit_buckets FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Auditors can view rate limit buckets"
  ON public.rate_limit_buckets FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'auditor'::app_role));

CREATE INDEX IF NOT EXISTS idx_rate_limit_buckets_updated
  ON public.rate_limit_buckets (updated_at);

-- Fixed-window counter consumed atomically: the INSERT .. ON CONFLICT DO UPDATE
-- takes a row lock, so concurrent edge invocations cannot both read a stale
-- count and each decide they are under the limit.
CREATE OR REPLACE FUNCTION public.consume_rate_limit(
  _bucket_key     text,
  _limit          integer,
  _window_seconds integer,
  _cost           integer DEFAULT 1
)
RETURNS TABLE (allowed boolean, remaining integer, reset_seconds integer, retry_after integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _now     timestamptz := clock_timestamp();
  _window  interval    := make_interval(secs => _window_seconds);
  _count   integer;
  _start   timestamptz;
  _blocked timestamptz;
BEGIN
  INSERT INTO public.rate_limit_buckets AS b (bucket_key, window_start, request_count, updated_at)
  VALUES (_bucket_key, _now, _cost, _now)
  ON CONFLICT (bucket_key) DO UPDATE SET
    window_start = CASE
      WHEN b.window_start + _window <= _now THEN _now
      ELSE b.window_start END,
    request_count = CASE
      WHEN b.window_start + _window <= _now THEN _cost
      ELSE b.request_count + _cost END,
    updated_at = _now
  RETURNING b.request_count, b.window_start, b.blocked_until
  INTO _count, _start, _blocked;

  reset_seconds := GREATEST(1, CEIL(EXTRACT(EPOCH FROM (_start + _window - _now)))::integer);

  -- An explicit block (set only for sustained abuse) outranks the counter.
  IF _blocked IS NOT NULL AND _blocked > _now THEN
    allowed     := false;
    remaining   := 0;
    retry_after := GREATEST(1, CEIL(EXTRACT(EPOCH FROM (_blocked - _now)))::integer);
    RETURN NEXT;
    RETURN;
  END IF;

  allowed     := _count <= _limit;
  remaining   := GREATEST(0, _limit - _count);
  retry_after := CASE WHEN allowed THEN 0 ELSE reset_seconds END;
  RETURN NEXT;
END;
$$;

-- Escalation hatch for sustained abuse (honeypot hits, extreme overuse).
-- Ordinary 429s never call this: a developer who overruns their limit simply
-- waits out the window rather than being locked out.
CREATE OR REPLACE FUNCTION public.block_rate_limit_bucket(
  _bucket_key text,
  _seconds    integer
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.rate_limit_buckets AS b (bucket_key, window_start, request_count, blocked_until, updated_at)
  VALUES (_bucket_key, now(), 0, now() + make_interval(secs => _seconds), now())
  ON CONFLICT (bucket_key) DO UPDATE SET
    blocked_until = GREATEST(
      COALESCE(b.blocked_until, now()),
      now() + make_interval(secs => _seconds)
    ),
    updated_at = now();
END;
$$;

-- ── 3. API key authentication ──────────────────────────────────────────────

-- Resolves a key hash to its authorisation context in a single round trip.
-- Read-only on purpose: usage is recorded separately, after the request has
-- actually been admitted, so rejected calls never burn a customer's quota.
CREATE OR REPLACE FUNCTION public.authenticate_api_key(_key_hash text)
RETURNS TABLE (
  key_id             uuid,
  owner_id           uuid,
  tier               text,
  scopes             text[],
  requires_signature boolean,
  auth_status        text,
  requests_month     integer,
  quota_limit        integer,
  quota_reset_at     timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  k             public.api_keys%ROWTYPE;
  _limit        integer;
  _period_start timestamptz := date_trunc('month', now());
  _used         integer;
BEGIN
  SELECT * INTO k FROM public.api_keys WHERE key_hash = _key_hash;

  IF NOT FOUND THEN
    auth_status := 'invalid_key';
    RETURN NEXT;
    RETURN;
  END IF;

  key_id             := k.id;
  owner_id           := k.user_id;
  tier               := k.tier;
  scopes             := k.scopes;
  requires_signature := k.requires_signature;

  IF k.revoked_at IS NOT NULL THEN
    auth_status := 'revoked';
    RETURN NEXT;
    RETURN;
  END IF;

  IF k.expires_at IS NOT NULL AND k.expires_at <= now() THEN
    auth_status := 'expired';
    RETURN NEXT;
    RETURN;
  END IF;

  _limit := CASE k.tier
              WHEN 'free' THEN 100000
              WHEN 'pro'  THEN 1000000
              ELSE -1                      -- enterprise: uncapped
            END;

  -- Roll the monthly window forward lazily rather than in a cron job.
  _used := CASE WHEN k.quota_period_start < _period_start THEN 0 ELSE k.requests_month END;

  requests_month := _used;
  quota_limit    := _limit;
  quota_reset_at := _period_start + interval '1 month';

  IF _limit > 0 AND _used >= _limit THEN
    auth_status := 'quota_exceeded';
    RETURN NEXT;
    RETURN;
  END IF;

  auth_status := 'active';
  RETURN NEXT;
END;
$$;

-- Called after the response is produced, off the request's critical path.
CREATE OR REPLACE FUNCTION public.record_api_key_usage(
  _key_id uuid,
  _cost   integer DEFAULT 1,
  _ip     text    DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _month timestamptz := date_trunc('month', now());
  _day   timestamptz := date_trunc('day', now());
BEGIN
  UPDATE public.api_keys SET
    requests_month = CASE WHEN quota_period_start < _month THEN _cost ELSE requests_month + _cost END,
    quota_period_start = CASE WHEN quota_period_start < _month THEN _month ELSE quota_period_start END,
    requests_today = CASE WHEN daily_period_start < _day THEN _cost ELSE requests_today + _cost END,
    daily_period_start = CASE WHEN daily_period_start < _day THEN _day ELSE daily_period_start END,
    last_request_at = now(),
    last_used_ip = COALESCE(_ip, last_used_ip)
  WHERE id = _key_id;
END;
$$;

-- ── 4. Replay protection for signed requests ───────────────────────────────

CREATE TABLE IF NOT EXISTS public.api_request_nonces (
  nonce_hash text PRIMARY KEY,
  key_id     uuid REFERENCES public.api_keys(id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL
);

ALTER TABLE public.api_request_nonces ENABLE ROW LEVEL SECURITY;
-- No policies: reachable only through the service role.

CREATE INDEX IF NOT EXISTS idx_api_request_nonces_expires
  ON public.api_request_nonces (expires_at);

-- Returns true when the nonce was unused (and is now claimed), false on replay.
CREATE OR REPLACE FUNCTION public.claim_request_nonce(
  _nonce_hash  text,
  _key_id      uuid,
  _ttl_seconds integer
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _inserted integer;
BEGIN
  INSERT INTO public.api_request_nonces (nonce_hash, key_id, expires_at)
  VALUES (_nonce_hash, _key_id, now() + make_interval(secs => _ttl_seconds))
  ON CONFLICT (nonce_hash) DO NOTHING;

  GET DIAGNOSTICS _inserted = ROW_COUNT;
  RETURN _inserted = 1;
END;
$$;

-- ── 5. Verified Privy subject -> app user mapping ──────────────────────────

-- Admin routes previously trusted an unverified JWT payload and an
-- `x-user-id` request header. They now resolve identity through this table,
-- which is written only by sync-privy-user after full JWKS verification.
CREATE TABLE IF NOT EXISTS public.privy_identities (
  privy_sub  text PRIMARY KEY,
  user_id    uuid NOT NULL,
  email      text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.privy_identities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own privy identity"
  ON public.privy_identities FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Super admins can view privy identities"
  ON public.privy_identities FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'::app_role));

CREATE INDEX IF NOT EXISTS idx_privy_identities_user
  ON public.privy_identities (user_id);

-- ── 6. Housekeeping ────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.prune_api_runtime_state()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.api_request_nonces WHERE expires_at < now();

  DELETE FROM public.rate_limit_buckets
  WHERE updated_at < now() - interval '1 day'
    AND (blocked_until IS NULL OR blocked_until < now());
END;
$$;

-- ── 7. Lock the helpers to the service role ────────────────────────────────
-- Postgres grants EXECUTE to PUBLIC by default; without this an anonymous
-- client could drain another tenant's rate limit bucket or burn their quota.

REVOKE ALL ON FUNCTION public.consume_rate_limit(text, integer, integer, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.block_rate_limit_bucket(text, integer)              FROM PUBLIC;
REVOKE ALL ON FUNCTION public.authenticate_api_key(text)                          FROM PUBLIC;
REVOKE ALL ON FUNCTION public.record_api_key_usage(uuid, integer, text)           FROM PUBLIC;
REVOKE ALL ON FUNCTION public.claim_request_nonce(text, uuid, integer)            FROM PUBLIC;
REVOKE ALL ON FUNCTION public.prune_api_runtime_state()                           FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.consume_rate_limit(text, integer, integer, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.block_rate_limit_bucket(text, integer)              TO service_role;
GRANT EXECUTE ON FUNCTION public.authenticate_api_key(text)                          TO service_role;
GRANT EXECUTE ON FUNCTION public.record_api_key_usage(uuid, integer, text)           TO service_role;
GRANT EXECUTE ON FUNCTION public.claim_request_nonce(text, uuid, integer)            TO service_role;
GRANT EXECUTE ON FUNCTION public.prune_api_runtime_state()                           TO service_role;
