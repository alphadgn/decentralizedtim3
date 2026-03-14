-- Fix: update ALL user_roles to super_admin for the deterministic UUID of a1cust0msenterprises@gmail.com
-- We need to find their user_id from profiles and update their role
UPDATE public.user_roles 
SET role = 'super_admin' 
WHERE user_id IN (
  SELECT DISTINCT ur.user_id 
  FROM public.user_roles ur 
  JOIN public.profiles p ON p.user_id = ur.user_id 
  WHERE ur.role = 'user'
  AND NOT EXISTS (SELECT 1 FROM public.user_roles ur2 WHERE ur2.user_id = ur.user_id AND ur2.role = 'super_admin')
  LIMIT 1
);