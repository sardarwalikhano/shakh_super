-- SHAKH: expose assigned-customer WhatsApp contact only to the assigned captain.
begin;
drop function if exists public.get_captain_customer_contact(uuid);
drop function if exists private.get_captain_customer_contact(uuid);
create function private.get_captain_customer_contact(p_order_id uuid)
returns table(full_name text,phone text,whatsapp_phone text)
language plpgsql security definer set search_path=''
as $function$
begin
 if auth.uid() is null then raise exception 'authentication_required'; end if;
 if not exists(select 1 from public.user_roles where user_id=auth.uid() and role='captain'::public.app_role and is_active=true) then raise exception 'captain_role_required'; end if;
 return query select p.full_name,p.phone,p.whatsapp_phone from public.orders o join public.profiles p on p.id=o.customer_id
 where o.id=p_order_id and o.captain_id=auth.uid() and o.status in ('assigned_to_captain'::public.order_status,'picked_up'::public.order_status,'on_the_way'::public.order_status);
end;
$function$;
create function public.get_captain_customer_contact(p_order_id uuid)
returns table(full_name text,phone text,whatsapp_phone text)
language plpgsql security invoker set search_path=''
as $function$
begin return query select * from private.get_captain_customer_contact(p_order_id); end;
$function$;
revoke execute on function private.get_captain_customer_contact(uuid) from public,anon;
grant usage on schema private to authenticated;
grant execute on function private.get_captain_customer_contact(uuid) to authenticated;
revoke execute on function public.get_captain_customer_contact(uuid) from public,anon;
grant execute on function public.get_captain_customer_contact(uuid) to authenticated;
commit;