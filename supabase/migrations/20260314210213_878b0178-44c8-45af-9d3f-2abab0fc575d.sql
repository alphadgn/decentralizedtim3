
CREATE TABLE public.user_preferences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  email_notifications boolean NOT NULL DEFAULT false,
  dashboard_auto_refresh boolean NOT NULL DEFAULT true,
  api_key_expiry_alerts boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.user_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own preferences" ON public.user_preferences
  FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE POLICY "Users can insert own preferences" ON public.user_preferences
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own preferences" ON public.user_preferences
  FOR UPDATE TO authenticated USING (user_id = auth.uid());

-- Security alerts table for email notifications
CREATE TABLE public.security_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_type text NOT NULL,
  severity text NOT NULL DEFAULT 'warning',
  message text NOT NULL,
  ip_address text,
  endpoint text,
  metadata jsonb DEFAULT '{}'::jsonb,
  acknowledged boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.security_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admins can view alerts" ON public.security_alerts
  FOR SELECT TO authenticated USING (has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Super admins can update alerts" ON public.security_alerts
  FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'super_admin'::app_role));
