-- SHAKH Stage 5: SECURITY DEFINER search_path hardening
-- Preserve existing authenticated RPC flows while removing public/anon execution
-- and pinning the search_path to an empty path.

ALTER FUNCTION public.claim_order(uuid)
  SET search_path = '';

ALTER FUNCTION public.create_order_with_stock(uuid, uuid, jsonb)
  SET search_path = '';

ALTER FUNCTION public.current_user_role()
  SET search_path = '';

ALTER FUNCTION public.get_captain_customer_contact(uuid)
  SET search_path = '';

ALTER FUNCTION public.is_admin()
  SET search_path = '';

ALTER FUNCTION public.transition_order_status(uuid, public.order_status)
  SET search_path = '';

REVOKE EXECUTE ON FUNCTION public.claim_order(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.claim_order(uuid) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.create_order_with_stock(uuid, uuid, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_order_with_stock(uuid, uuid, jsonb) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.current_user_role() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.current_user_role() TO authenticated;

REVOKE EXECUTE ON FUNCTION public.get_captain_customer_contact(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_captain_customer_contact(uuid) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.is_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;

REVOKE EXECUTE ON FUNCTION public.transition_order_status(uuid, public.order_status) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.transition_order_status(uuid, public.order_status) TO authenticated;
