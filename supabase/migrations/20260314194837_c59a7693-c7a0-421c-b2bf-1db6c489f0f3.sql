
-- Security logs table for monitoring all API access, abuse, and honeypot hits
CREATE TABLE public.security_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type text NOT NULL DEFAULT 'api_request',
  severity text NOT NULL DEFAULT 'info',
  ip_address text,
  user_agent text,
  endpoint text,
  method text,
  api_key_id uuid REFERENCES public.api_keys(id),
  user_id uuid,
  request_signature text,
  response_code integer,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Index for fast querying
CREATE INDEX idx_security_logs_event_type ON public.security_logs(event_type);
CREATE INDEX idx_security_logs_created_at ON public.security_logs(created_at DESC);
CREATE INDEX idx_security_logs_ip ON public.security_logs(ip_address);
CREATE INDEX idx_security_logs_severity ON public.security_logs(severity);

-- RLS: only super_admins can view security logs
ALTER TABLE public.security_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admins can view security logs"
  ON public.security_logs FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'::app_role));

-- No insert/update/delete from client — only edge functions via service role

-- User subscriptions table
CREATE TABLE public.user_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  tier text NOT NULL DEFAULT 'free',
  status text NOT NULL DEFAULT 'active',
  stripe_customer_id text,
  stripe_subscription_id text,
  current_period_start timestamptz,
  current_period_end timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

ALTER TABLE public.user_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own subscription"
  ON public.user_subscriptions FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Admins can view all subscriptions"
  ON public.user_subscriptions FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'super_admin'::app_role));

-- IP rate limiting table
CREATE TABLE public.ip_rate_limits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ip_address text NOT NULL,
  endpoint text NOT NULL DEFAULT '*',
  request_count integer NOT NULL DEFAULT 1,
  window_start timestamptz NOT NULL DEFAULT now(),
  blocked_until timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(ip_address, endpoint)
);

ALTER TABLE public.ip_rate_limits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admins can view rate limits"
  ON public.ip_rate_limits FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'::app_role));
