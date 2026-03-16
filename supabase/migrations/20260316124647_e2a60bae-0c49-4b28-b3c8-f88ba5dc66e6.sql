
-- Trade Commitments table for Global Market Clock
CREATE TABLE public.trade_commitments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  exchange_id text NOT NULL,
  trade_id text NOT NULL,
  trade_hash text NOT NULL,
  client_signature text NOT NULL,
  nonce text NOT NULL,
  canonical_timestamp bigint NOT NULL,
  sequence_number bigint NOT NULL,
  event_hash text NOT NULL,
  ordering_hash text NOT NULL,
  validator_signatures jsonb NOT NULL DEFAULT '[]'::jsonb,
  merkle_proof text,
  blockchain_anchor_ref text,
  status text NOT NULL DEFAULT 'committed',
  api_key_id uuid REFERENCES public.api_keys(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Used nonces for replay protection
CREATE TABLE public.used_nonces (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nonce_hash text NOT NULL,
  exchange_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(nonce_hash, exchange_id)
);

-- Sequence for deterministic ordering
CREATE SEQUENCE IF NOT EXISTS public.gmc_commitment_seq START 1;

-- Function to get next GMC sequence number
CREATE OR REPLACE FUNCTION public.nextval_gmc_seq()
RETURNS bigint
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT nextval('public.gmc_commitment_seq');
$$;

-- Index for fast lookups
CREATE INDEX idx_trade_commitments_exchange ON public.trade_commitments(exchange_id);
CREATE INDEX idx_trade_commitments_event_hash ON public.trade_commitments(event_hash);
CREATE INDEX idx_trade_commitments_timestamp ON public.trade_commitments(canonical_timestamp);
CREATE INDEX idx_trade_commitments_sequence ON public.trade_commitments(sequence_number);
CREATE INDEX idx_used_nonces_hash ON public.used_nonces(nonce_hash, exchange_id);
CREATE INDEX idx_used_nonces_created ON public.used_nonces(created_at);

-- RLS policies
ALTER TABLE public.trade_commitments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.used_nonces ENABLE ROW LEVEL SECURITY;

-- Trade commitments: key owners can read their own
CREATE POLICY "Key owners can read trade commitments"
ON public.trade_commitments FOR SELECT TO authenticated
USING (api_key_id IN (SELECT id FROM public.api_keys WHERE user_id = auth.uid()));

-- Super admins can view all trade commitments
CREATE POLICY "Super admins can view all trade commitments"
ON public.trade_commitments FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'super_admin'::app_role));

-- Service role inserts (edge functions use service role)
-- No INSERT policy needed for authenticated users since edge functions use service role

-- Used nonces: no direct access needed (managed by edge functions via service role)
