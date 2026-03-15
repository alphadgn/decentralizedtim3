-- Protect founder and customer-service identities at the database level

-- Ensure critical emails are always approved for login flow checks
INSERT INTO public.approved_emails (email)
SELECT 'a1cust0msenterprises@gmail.com'
WHERE NOT EXISTS (
  SELECT 1 FROM public.approved_emails WHERE email = 'a1cust0msenterprises@gmail.com'
);

INSERT INTO public.approved_emails (email)
SELECT 'decentralizedtim3@gmail.com'
WHERE NOT EXISTS (
  SELECT 1 FROM public.approved_emails WHERE email = 'decentralizedtim3@gmail.com'
);

-- Normalize protected accounts' roles
DELETE FROM public.user_roles
WHERE user_id = 'a7069b27-a45c-4712-8a06-6c87a29bcfbf'::uuid
  AND role <> 'super_admin'::public.app_role;

UPDATE public.user_roles
SET role = 'support'::public.app_role
WHERE user_id = '4d50e583-19fc-488d-8dc1-d2cf87378769'::uuid
  AND role IN ('admin'::public.app_role, 'super_admin'::public.app_role);

INSERT INTO public.user_roles (user_id, role)
SELECT 'a7069b27-a45c-4712-8a06-6c87a29bcfbf'::uuid, 'super_admin'::public.app_role
WHERE NOT EXISTS (
  SELECT 1
  FROM public.user_roles
  WHERE user_id = 'a7069b27-a45c-4712-8a06-6c87a29bcfbf'::uuid
    AND role = 'super_admin'::public.app_role
);

-- Enforce protected-role rules going forward
CREATE OR REPLACE FUNCTION public.enforce_protected_user_roles()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  founder_id constant uuid := 'a7069b27-a45c-4712-8a06-6c87a29bcfbf'::uuid;
  customer_service_id constant uuid := '4d50e583-19fc-488d-8dc1-d2cf87378769'::uuid;
  actor_id uuid := auth.uid();
BEGIN
  IF TG_OP IN ('INSERT', 'UPDATE') THEN
    -- Founder must remain super_admin, except if founder intentionally changes it.
    IF NEW.user_id = founder_id
       AND NEW.role <> 'super_admin'::public.app_role
       AND actor_id IS DISTINCT FROM founder_id THEN
      RAISE EXCEPTION 'Founder super administrator role is protected';
    END IF;

    -- Only founder can grant super_admin to another account.
    IF NEW.role = 'super_admin'::public.app_role
       AND NEW.user_id <> founder_id
       AND actor_id IS DISTINCT FROM founder_id THEN
      RAISE EXCEPTION 'Only founder super administrator can assign super_admin role';
    END IF;

    -- Customer service account must not be admin-tier.
    IF NEW.user_id = customer_service_id
       AND NEW.role IN ('admin'::public.app_role, 'super_admin'::public.app_role) THEN
      RAISE EXCEPTION 'Customer service account cannot be assigned admin or super_admin roles';
    END IF;

    RETURN NEW;
  END IF;

  IF TG_OP = 'DELETE'
     AND OLD.user_id = founder_id
     AND actor_id IS DISTINCT FROM founder_id THEN
    RAISE EXCEPTION 'Founder super administrator role cannot be removed';
  END IF;

  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_protected_user_roles ON public.user_roles;

CREATE TRIGGER trg_enforce_protected_user_roles
BEFORE INSERT OR UPDATE OR DELETE ON public.user_roles
FOR EACH ROW
EXECUTE FUNCTION public.enforce_protected_user_roles();