-- Shakh RLS performance hardening
-- Backward-compatible: policy semantics remain unchanged.
begin;

drop policy if exists notifications_self on public.notifications;
drop policy if exists users_read_own_notifications on public.notifications;
create policy notifications_self
on public.notifications
for select
to authenticated
using (
  (user_id = (select auth.uid()))
  or (select is_admin())
);

drop policy if exists notifications_update on public.notifications;
drop policy if exists users_update_own_notifications on public.notifications;
create policy notifications_update
on public.notifications
for update
to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

drop policy if exists products_manage_owner_admin on public.products;
create policy products_manage_owner_admin
on public.products
for all
to authenticated
using (
  exists (
    select 1
    from public.stores s
    where s.id = products.store_id
      and (
        s.owner_id = (select auth.uid())
        or (select is_admin())
      )
  )
)
with check (
  exists (
    select 1
    from public.stores s
    where s.id = products.store_id
      and (
        s.owner_id = (select auth.uid())
        or (select is_admin())
      )
  )
);

drop policy if exists products_public_read on public.products;
drop policy if exists products_public on public.products;
create policy products_public
on public.products
for select
to public
using (is_available = true);

drop policy if exists stores_public on public.stores;
drop policy if exists stores_select_public on public.stores;
create policy stores_public
on public.stores
for select
to public
using (is_active = true);

drop policy if exists stores_insert_owner_admin on public.stores;
create policy stores_insert_owner_admin
on public.stores
for insert
to authenticated
with check (
  owner_id = (select auth.uid())
  or (select is_admin())
);

drop policy if exists stores_delete_owner_admin on public.stores;
create policy stores_delete_owner_admin
on public.stores
for delete
to authenticated
using (
  owner_id = (select auth.uid())
  or (select is_admin())
);

drop policy if exists stores_update_owner_admin on public.stores;
create policy stores_update_owner_admin
on public.stores
for update
to authenticated
using (
  owner_id = (select auth.uid())
  or (select is_admin())
)
with check (
  (select is_admin())
  or owner_id = (
    select s.owner_id
    from public.stores s
    where s.id = stores.id
  )
);

drop policy if exists posts_delete on public.posts;
create policy posts_delete
on public.posts
for delete
to authenticated
using (
  (author_id = (select auth.uid()))
  or (select is_admin())
);

drop policy if exists posts_insert on public.posts;
create policy posts_insert
on public.posts
for insert
to authenticated
with check (
  (author_id = (select auth.uid()))
  and (
    (select is_admin())
    or (
      (select current_user_role()) = 'restaurant_vendor'
      and post_type = 'food'
    )
    or (
      (select current_user_role()) = 'supermarket_vendor'
      and post_type = 'marketplace'
    )
    or (
      (select current_user_role()) = 'fashion_vendor'
      and post_type = 'fashion'
    )
    or (
      (select current_user_role()) = 'vendor'
      and post_type = 'marketplace'
    )
    or (
      (select current_user_role()) = 'electronics_vendor'
      and post_type = 'marketplace'
    )
    or (
      (select current_user_role()) = 'jewelry_vendor'
      and post_type = 'marketplace'
    )
    or (
      (select current_user_role()) = 'car_dealer'
      and post_type = 'car'
    )
    or (
      (select current_user_role()) = 'umrah_agency'
      and post_type = 'umrah'
    )
    or (
      (select current_user_role()) = 'captain'
      and post_type = 'delivery'
    )
    or (
      (select current_user_role()) = 'customer'
      and post_type = any(array['general','marketplace'])
    )
  )
);

drop policy if exists posts_public on public.posts;
create policy posts_public
on public.posts
for select
to public
using (
  (status = 'approved' and visibility = 'public')
  or (author_id = (select auth.uid()))
  or (select is_admin())
);

drop policy if exists posts_update on public.posts;
create policy posts_update
on public.posts
for update
to authenticated
using (
  (author_id = (select auth.uid()))
  or (select is_admin())
)
with check (
  (author_id = (select auth.uid()))
  or (select is_admin())
);

commit;
