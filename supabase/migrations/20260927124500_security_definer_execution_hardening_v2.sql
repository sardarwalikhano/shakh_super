-- Shakh SECURITY DEFINER execution hardening v2
-- Remove explicit RPC execution grants from internal trigger helpers.
begin;

revoke execute on function public.current_user_role() from public;
revoke execute on function public.current_user_role() from anon;

revoke execute on function public.enforce_shakh_store_publisher() from public, anon, authenticated;
revoke execute on function public.handle_order_status_change() from public, anon, authenticated;
revoke execute on function public.notify_order_status_change() from public, anon, authenticated;
revoke execute on function public.record_order_status_change() from public, anon, authenticated;
revoke execute on function public.sync_profile_role_from_user_roles() from public, anon, authenticated;

commit;
