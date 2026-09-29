-- Stage 16: move RLS role helpers behind a private schema
-- Public wrappers remain for backward compatibility and RLS policy references,
-- but no longer execute with definer privileges.

BEGIN;

CREATE SCHEMA IF NOT EXISTS private;

CREATE OR REPLACE FUNCTION private.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = (SELECT auth.uid())
      AND role IN ('super_admin'::public.app_role, 'admin'::public.app_role)
      AND is_active = true
  );
$$;

CREATE OR REPLACE FUNCTION private.current_user_role()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT (
    SELECT ur.role::text
    FROM public.user_roles ur
    WHERE ur.user_id = (SELECT auth.uid())
      AND ur.is_active = true
    ORDER BY
      CASE
        WHEN ur.role = 'super_admin'::public.app_role THEN 1
        WHEN ur.role = 'admin'::public.app_role THEN 2
        ELSE 3
      END,
      ur.created_at DESC NULLS LAST
    LIMIT 1
  );
$$;

REVOKE ALL ON SCHEMA private FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION private.is_admin() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION private.current_user_role() FROM PUBLIC, anon, authenticated;

GRANT USAGE ON SCHEMA private TO authenticated;
GRANT EXECUTE ON FUNCTION private.is_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION private.current_user_role() TO authenticated;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT private.is_admin();
$$;

CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS text
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT private.current_user_role();
$$;

COMMIT;
