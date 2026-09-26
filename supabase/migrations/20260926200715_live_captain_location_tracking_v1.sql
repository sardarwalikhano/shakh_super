create table if not exists public.delivery_tracking_locations (
  order_id uuid primary key references public.orders(id) on delete cascade,
  captain_id uuid not null references auth.users(id) on delete cascade,
  latitude double precision not null check (latitude between -90 and 90),
  longitude double precision not null check (longitude between -180 and 180),
  accuracy_m double precision,
  heading double precision,
  speed_mps double precision,
  updated_at timestamptz not null default now()
);

create index if not exists delivery_tracking_locations_captain_id_idx
  on public.delivery_tracking_locations(captain_id);

alter table public.delivery_tracking_locations enable row level security;

drop policy if exists "tracking_select_relevant" on public.delivery_tracking_locations;
create policy "tracking_select_relevant"
  on public.delivery_tracking_locations
  for select
  to authenticated
  using (
    exists (
      select 1 from public.orders o
      where o.id = delivery_tracking_locations.order_id
        and (
          o.customer_id = (select auth.uid())
          or o.captain_id = (select auth.uid())
          or public.is_admin()
        )
    )
  );

drop policy if exists "tracking_insert_captain" on public.delivery_tracking_locations;
create policy "tracking_insert_captain"
  on public.delivery_tracking_locations
  for insert
  to authenticated
  with check (
    captain_id = (select auth.uid())
    and exists (
      select 1 from public.orders o
      where o.id = delivery_tracking_locations.order_id
        and o.captain_id = (select auth.uid())
        and o.status in ('assigned_to_captain'::order_status,'picked_up'::order_status,'on_the_way'::order_status)
    )
  );

drop policy if exists "tracking_update_captain" on public.delivery_tracking_locations;
create policy "tracking_update_captain"
  on public.delivery_tracking_locations
  for update
  to authenticated
  using (
    captain_id = (select auth.uid())
    and exists (
      select 1 from public.orders o
      where o.id = delivery_tracking_locations.order_id
        and o.captain_id = (select auth.uid())
        and o.status in ('assigned_to_captain'::order_status,'picked_up'::order_status,'on_the_way'::order_status)
    )
  )
  with check (
    captain_id = (select auth.uid())
    and exists (
      select 1 from public.orders o
      where o.id = delivery_tracking_locations.order_id
        and o.captain_id = (select auth.uid())
        and o.status in ('assigned_to_captain'::order_status,'picked_up'::order_status,'on_the_way'::order_status)
    )
  );

drop policy if exists "tracking_delete_captain" on public.delivery_tracking_locations;
create policy "tracking_delete_captain"
  on public.delivery_tracking_locations
  for delete
  to authenticated
  using (
    captain_id = (select auth.uid())
    and exists (
      select 1 from public.orders o
      where o.id = delivery_tracking_locations.order_id
        and o.captain_id = (select auth.uid())
    )
  );

alter publication supabase_realtime add table public.delivery_tracking_locations;