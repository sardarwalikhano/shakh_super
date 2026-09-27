-- Shakh profile RLS hardening
-- Users can edit profile details but cannot self-promote their role.
begin;

drop policy if exists profiles_self_admin on public.profiles;

create policy profiles_select_self_admin
on public.profiles
for select
to authenticated
using (
  (id = (select auth.uid()))
  or (select is_admin())
);

create policy profiles_update_self_admin
on public.profiles
for update
to authenticated
using (
  (id = (select auth.uid()))
  or (select is_admin())
)
with check (
  (select is_admin())
  or (
    id = (select auth.uid())
    and role = (
      select p.role
      from public.profiles p
      where p.id = profiles.id
    )
  )
);

create policy profiles_insert_admin
on public.profiles
for insert
to authenticated
with check ((select is_admin()));

create policy profiles_delete_admin
on public.profiles
for delete
to authenticated
using ((select is_admin()));

commit;
