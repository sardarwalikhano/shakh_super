-- Allow a captain to read the delivery address only when the order is assigned to them.
drop policy if exists "captains_read_assigned_delivery_addresses" on public.delivery_addresses;

create policy "captains_read_assigned_delivery_addresses"
on public.delivery_addresses
for select
to authenticated
using (
  (select auth.uid()) = user_id
  or exists (
    select 1
    from public.orders o
    where o.address_id = public.delivery_addresses.id
      and o.captain_id = (select auth.uid())
  )
);