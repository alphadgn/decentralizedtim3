
-- Add minimal RLS policy for used_nonces (only super admins can view for auditing)
CREATE POLICY "Super admins can view used nonces"
ON public.used_nonces FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'super_admin'::app_role));
