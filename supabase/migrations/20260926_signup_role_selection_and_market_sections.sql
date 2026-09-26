-- SHAKH: safe signup role selection + additional marketplace sections
-- Public signup may select only non-admin roles.

DO $$
BEGIN
  ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'jewelry_vendor';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'electronics_vendor';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE public.stores DROP CONSTRAINT IF EXISTS stores_category_check;
ALTER TABLE public.stores
  ADD CONSTRAINT stores_category_check
  CHECK (category = ANY (ARRAY['restaurant','supermarket','fashion','daily','marketplace','jewelry','electronics']));

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  requested_role text;
  safe_role text;
BEGIN
  requested_role := lower(coalesce(new.raw_user_meta_data->>'role', 'customer'));

  safe_role := CASE requested_role
    WHEN 'customer' THEN 'customer'
    WHEN 'vendor' THEN 'vendor'
    WHEN 'restaurant_vendor' THEN 'restaurant_vendor'
    WHEN 'supermarket_vendor' THEN 'supermarket_vendor'
    WHEN 'fashion_vendor' THEN 'fashion_vendor'
    WHEN 'jewelry_vendor' THEN 'jewelry_vendor'
    WHEN 'electronics_vendor' THEN 'electronics_vendor'
    WHEN 'captain' THEN 'captain'
    WHEN 'car_dealer' THEN 'car_dealer'
    WHEN 'umrah_agency' THEN 'umrah_agency'
    ELSE 'customer'
  END;

  INSERT INTO public.profiles(id, full_name, email, role)
  VALUES (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name'),
    new.email,
    safe_role
  )
  ON CONFLICT(id) DO UPDATE
    SET full_name = EXCLUDED.full_name,
        email = EXCLUDED.email,
        role = CASE
          WHEN public.profiles.role IN ('super_admin','admin') THEN public.profiles.role
          ELSE EXCLUDED.role
        END,
        updated_at = now();

  INSERT INTO public.user_roles(user_id, role)
  VALUES (new.id, safe_role::public.app_role)
  ON CONFLICT DO NOTHING;

  INSERT INTO public.wallets(user_id)
  VALUES(new.id)
  ON CONFLICT(user_id) DO NOTHING;

  RETURN new;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

COMMENT ON COLUMN public.profiles.role IS 'Signup roles: customer, vendor, restaurant_vendor, supermarket_vendor, fashion_vendor, jewelry_vendor, electronics_vendor, captain, car_dealer, umrah_agency. Admin roles are assigned only by administrators.';
