create or replace function public.get_captain_customer_contact(p_order_id uuid)
returns table(full_name text, phone text)
language plpgsql
security definer
set search_path = public
as $function$
begin
  if auth.uid() is null then
    raise exception 'authentication_required';
  end if;

  if not exists (
    select 1
    from public.user_roles
    where user_id = auth.uid()
      and role = 'captain'::public.app_role
      and is_active = true
  ) then
    raise exception 'captain_role_required';
  end if;

  return query
  select p.full_name, p.phone
  from public.orders o
  join public.profiles p on p.id = o.customer_id
  where o.id = p_order_id
    and o.captain_id = auth.uid()
    and o.status in (
      'assigned_to_captain'::public.order_status,
      'picked_up'::public.order_status,
      'on_the_way'::public.order_status
    );
end;
$function$;

revoke execute on function public.get_captain_customer_contact(uuid) from public;
revoke execute on function public.get_captain_customer_contact(uuid) from anon;
grant execute on function public.get_captain_customer_contact(uuid) to authenticated;