-- SHAKH Stage 10 corrective migration: remove the bidirectional RBAC trigger
-- that was intentionally rolled back after runtime verification detected recursion.
-- The existing user_roles -> profiles trigger remains the single synchronization direction.

DROP TRIGGER IF EXISTS trg_sync_profile_role_to_user_roles ON public.profiles;
DROP FUNCTION IF EXISTS public.sync_profile_role_to_user_roles();

ALTER TABLE public.profiles
  ALTER COLUMN role SET DEFAULT 'customer',
  ALTER COLUMN role SET NOT NULL,
  DROP CONSTRAINT IF EXISTS profiles_role_valid,
  ADD CONSTRAINT profiles_role_valid CHECK (
    role = ANY (ARRAY[
      'super_admin','admin','customer','vendor','restaurant_vendor',
      'supermarket_vendor','fashion_vendor','captain','support',
      'car_dealer','umrah_agency','jewelry_vendor','electronics_vendor'
    ])
  );

UPDATE public.user_roles ur
SET is_active = true
FROM public.profiles p
WHERE p.id = ur.user_id
  AND ur.role::text = p.role;

UPDATE public.user_roles ur
SET is_active = false
FROM public.profiles p
WHERE p.id = ur.user_id
  AND ur.role::text <> p.role;
