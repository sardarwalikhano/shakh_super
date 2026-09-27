-- Shakh SECURITY DEFINER execution hardening
-- Keep client-required RPCs authenticated; close direct access to internal helpers.
begin;

revoke execute on function public.create_order_from_cart(uuid,uuid,numeric,numeric,numeric,text,text) from anon;

revoke execute on function public.current_user_role() from anon;

revoke execute on function public.enforce_shakh_store_publisher() from public;
revoke execute on function public.handle_order_status_change() from public;
revoke execute on function public.notify_order_status_change() from public;
revoke execute on function public.record_order_status_change() from public;
revoke execute on function public.sync_profile_role_from_user_roles() from public;

commit;
