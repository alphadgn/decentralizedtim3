
-- Fix permissive INSERT policy on trade_events - edge functions use service role which bypasses RLS
DROP POLICY "Service can insert trade events" ON public.trade_events;

-- Only authenticated users with matching api_key can insert
CREATE POLICY "Authenticated can insert trade events" ON public.trade_events
  FOR INSERT TO authenticated
  WITH CHECK (api_key_id IN (SELECT id FROM public.api_keys WHERE user_id = auth.uid()));
