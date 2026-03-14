
-- API keys table for developer authentication
CREATE TABLE public.api_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  key_hash text NOT NULL,
  key_prefix text NOT NULL,
  name text NOT NULL DEFAULT 'Default',
  tier text NOT NULL DEFAULT 'free' CHECK (tier IN ('free', 'pro', 'enterprise')),
  requests_today integer NOT NULL DEFAULT 0,
  requests_month integer NOT NULL DEFAULT 0,
  last_request_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  revoked_at timestamp with time zone,
  UNIQUE(key_hash)
);

ALTER TABLE public.api_keys ENABLE ROW LEVEL SECURITY;

-- Users can view their own keys
CREATE POLICY "Users can view own api keys" ON public.api_keys
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- Users can insert their own keys
CREATE POLICY "Users can insert own api keys" ON public.api_keys
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Users can update (revoke) their own keys
CREATE POLICY "Users can update own api keys" ON public.api_keys
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid());

-- Admins can view all keys
CREATE POLICY "Admins can view all api keys" ON public.api_keys
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role));

-- Time anchors table for blockchain anchoring
CREATE TABLE public.time_anchors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  epoch bigint NOT NULL,
  consensus_hash text NOT NULL,
  validator_signatures jsonb NOT NULL DEFAULT '[]'::jsonb,
  blockchain text NOT NULL DEFAULT 'ethereum',
  block_number bigint,
  tx_hash text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.time_anchors ENABLE ROW LEVEL SECURITY;

-- Public read for time anchors
CREATE POLICY "Anyone can read time anchors" ON public.time_anchors
  FOR SELECT TO anon, authenticated
  USING (true);

-- Trade events ledger
CREATE TABLE public.trade_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sequence_number bigint NOT NULL,
  canonical_timestamp bigint NOT NULL,
  exchange_id text NOT NULL,
  event_hash text NOT NULL,
  signature text NOT NULL,
  verification_proof text,
  api_key_id uuid REFERENCES public.api_keys(id),
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.trade_events ENABLE ROW LEVEL SECURITY;

-- Enterprise users can read their own trade events
CREATE POLICY "Key owners can read trade events" ON public.trade_events
  FOR SELECT TO authenticated
  USING (api_key_id IN (SELECT id FROM public.api_keys WHERE user_id = auth.uid()));

-- Service role inserts (edge function)
CREATE POLICY "Service can insert trade events" ON public.trade_events
  FOR INSERT TO anon, authenticated
  WITH CHECK (true);

-- Node staking table
CREATE TABLE public.node_stakes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  node_id uuid REFERENCES public.node_registrations(id) ON DELETE CASCADE NOT NULL,
  user_id uuid NOT NULL,
  stake_amount numeric NOT NULL DEFAULT 0,
  trust_score numeric NOT NULL DEFAULT 100,
  drift_avg_ms numeric NOT NULL DEFAULT 0,
  reputation text NOT NULL DEFAULT 'trusted' CHECK (reputation IN ('trusted', 'acceptable', 'penalized')),
  slashed_amount numeric NOT NULL DEFAULT 0,
  last_observation_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(node_id)
);

ALTER TABLE public.node_stakes ENABLE ROW LEVEL SECURITY;

-- Users can view their own stakes
CREATE POLICY "Users can view own stakes" ON public.node_stakes
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- Users can insert their own stakes
CREATE POLICY "Users can insert own stakes" ON public.node_stakes
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Users can update their own stakes
CREATE POLICY "Users can update own stakes" ON public.node_stakes
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid());

-- Admins can view all stakes
CREATE POLICY "Admins can view all stakes" ON public.node_stakes
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role));

-- Public read for node stakes (reputation is public)
CREATE POLICY "Public can view node stakes" ON public.node_stakes
  FOR SELECT TO anon
  USING (true);

-- Create sequence for trade events
CREATE SEQUENCE IF NOT EXISTS public.trade_event_seq START WITH 948271000;
