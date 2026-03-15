
-- SECURITY FIX 1: Remove user INSERT/UPDATE on node_stakes (privilege escalation)
DROP POLICY IF EXISTS "Users can insert own stakes" ON public.node_stakes;
DROP POLICY IF EXISTS "Users can update own stakes" ON public.node_stakes;

-- SECURITY FIX 2: Add unique constraint on ip_rate_limits for atomic upsert
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'ip_rate_limits_ip_endpoint_unique'
  ) THEN
    ALTER TABLE public.ip_rate_limits 
    ADD CONSTRAINT ip_rate_limits_ip_endpoint_unique 
    UNIQUE (ip_address, endpoint);
  END IF;
END $$;
