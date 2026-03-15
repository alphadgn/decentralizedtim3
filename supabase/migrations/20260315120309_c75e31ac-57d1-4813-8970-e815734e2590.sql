
-- Force the super admin role for the known super admin user
UPDATE public.user_roles
SET role = 'super_admin'
WHERE user_id = 'a7069b27-a45c-4712-8a06-6c87a29bcfbf';

-- If no row exists, insert it
INSERT INTO public.user_roles (user_id, role)
SELECT 'a7069b27-a45c-4712-8a06-6c87a29bcfbf', 'super_admin'
WHERE NOT EXISTS (
  SELECT 1 FROM public.user_roles WHERE user_id = 'a7069b27-a45c-4712-8a06-6c87a29bcfbf'
);

-- Delete any duplicate "user" role rows for this user
DELETE FROM public.user_roles
WHERE user_id = 'a7069b27-a45c-4712-8a06-6c87a29bcfbf'
  AND role != 'super_admin';
