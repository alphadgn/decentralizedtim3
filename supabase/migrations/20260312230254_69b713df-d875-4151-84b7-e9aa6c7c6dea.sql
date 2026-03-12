
-- Approved emails whitelist
CREATE TABLE public.approved_emails (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE,
  approved_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.approved_emails ENABLE ROW LEVEL SECURITY;

-- Super admins and admins can view
CREATE POLICY "Admins can view approved emails" ON public.approved_emails
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role));

-- Only super admins can manage
CREATE POLICY "Super admins can insert approved emails" ON public.approved_emails
  FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role) OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Super admins can delete approved emails" ON public.approved_emails
  FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'super_admin'::app_role));

-- Blocked users table (stores IP and email of unauthorized attempts)
CREATE TABLE public.blocked_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  ip_address text,
  attempt_count int NOT NULL DEFAULT 1,
  blocked_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.blocked_users ENABLE ROW LEVEL SECURITY;

-- Only super admins can view blocked users
CREATE POLICY "Super admins can view blocked users" ON public.blocked_users
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Super admins can delete blocked users" ON public.blocked_users
  FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'super_admin'::app_role));

-- Seed the super admin email into approved_emails
INSERT INTO public.approved_emails (email) VALUES ('a1cust0msenterprises@gmail.com');
