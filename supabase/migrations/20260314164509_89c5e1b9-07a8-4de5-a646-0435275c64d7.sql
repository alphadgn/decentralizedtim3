
-- Create a function to get next trade event sequence number
CREATE OR REPLACE FUNCTION public.nextval_trade_seq()
RETURNS bigint
LANGUAGE sql
SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT nextval('public.trade_event_seq');
$$;
