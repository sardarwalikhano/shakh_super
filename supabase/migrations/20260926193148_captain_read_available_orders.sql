drop policy if exists "captains_read_available_orders" on public.orders;

create policy "captains_read_available_orders"
on public.orders
for select
to authenticated
using (
  status = 'ready_for_pickup'::public.order_status
  and captain_id is null
  and exists (
    select 1
    from public.user_roles ur
    join public.captains c on c.user_id = ur.user_id
    where ur.user_id = (select auth.uid())
      and ur.role = 'captain'::public.app_role
      and ur.is_active = true
      and c.is_online = true
  )
);

drop policy if exists "captains_read_available_order_items" on public.order_items;

create policy "captains_read_available_order_items"
on public.order_items
for select
to authenticated
using (
  exists (
    select 1
    from public.orders o
    where o.id = order_items.order_id
      and (
        o.captain_id = (select auth.uid())
        or (
          o.status = 'ready_for_pickup'::public.order_status
          and o.captain_id is null
          and exists (
            select 1
            from public.user_roles ur
            join public.captains c on c.user_id = ur.user_id
            where ur.user_id = (select auth.uid())
              and ur.role = 'captain'::public.app_role
              and ur.is_active = true
              and c.is_online = true
          )
        )
      )
  )
);