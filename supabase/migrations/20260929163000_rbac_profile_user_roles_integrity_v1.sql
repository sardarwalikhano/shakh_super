-- SHAKH Stage 10: keep profile RBAC and user_roles synchronized.

UPDATE public.profiles
SET role = 'customer'
WHERE role IS NULL OR btrim(role) = '';

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

CREATE OR REPLACE FUNCTION public.sync_profile_role_to_user_roles()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
BEGIN
  IF NEW.role IS DISTINCT FROM OLD.role THEN
    UPDATE public.user_roles
    SET is_active = false
    WHERE user_id = NEW.id;

    INSERT INTO public.user_roles(user_id, role, is_active)
    VALUES (NEW.id, NEW.role::public.app_role, true)
    ON CONFLICT (user_id, role)
    DO UPDATE SET is_active = true;
  END IF;
  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public.sync_profile_role_to_user_roles() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_sync_profile_role_to_user_roles ON public.profiles;
CREATE TRIGGER trg_sync_profile_role_to_user_roles
AFTER UPDATE OF role ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.sync_profile_role_to_user_roles();

UPDATE public.user_roles ur
SET is_active = (ur.role::text = p.role)
FROM public.profiles p
WHERE p.id = ur.user_id;
