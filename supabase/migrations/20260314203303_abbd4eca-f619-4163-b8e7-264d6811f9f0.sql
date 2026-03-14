DROP POLICY IF EXISTS "Public can view node stakes" ON public.node_stakes;

CREATE OR REPLACE VIEW public.node_stakes_public AS
SELECT
  id,
  node_id,
  stake_amount,
  trust_score,
  reputation,
  drift_avg_ms,
  last_observation_at,
  created_at,
  updated_at
FROM public.node_stakes;

GRANT SELECT ON public.node_stakes_public TO anon;