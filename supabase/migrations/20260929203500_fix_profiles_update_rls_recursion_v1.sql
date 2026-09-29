-- Fix profiles UPDATE RLS recursion.
-- Do not query public.profiles from its own UPDATE WITH CHECK expression.

BEGIN;

DROP POLICY IF EXISTS profiles_update_self_admin ON public.profiles;

CREATE POLICY profiles_update_self_admin
ON public.profiles
FOR UPDATE
TO authenticated
USING (
  id = (SELECT auth.uid())
  OR (SELECT is_admin())
)
WITH CHECK (
  (SELECT is_admin())
  OR (
    id = (SELECT auth.uid())
    AND role = COALESCE(
      (
        SELECT ur.role::text
        FROM public.user_roles ur
        WHERE ur.user_id = (SELECT auth.uid())
          AND ur.is_active = true
        ORDER BY ur.created_at DESC NULLS LAST
        LIMIT 1
      ),
      role
    )
  )
);

COMMIT;
