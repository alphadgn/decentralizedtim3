-- Allow auditors to read security_logs (read-only)
CREATE POLICY "Auditors can view security logs"
ON public.security_logs
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'auditor'::app_role));

-- Allow auditors to read security_alerts (read-only)
CREATE POLICY "Auditors can view security alerts"
ON public.security_alerts
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'auditor'::app_role));

-- Allow auditors to read ip_rate_limits (read-only)
CREATE POLICY "Auditors can view rate limits"
ON public.ip_rate_limits
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'auditor'::app_role));

-- Allow support role to read profiles
CREATE POLICY "Support can view all profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'support'::app_role));

-- Allow support role to read node_registrations
CREATE POLICY "Support can view all nodes"
ON public.node_registrations
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'support'::app_role));