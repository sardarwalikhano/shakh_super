-- SHAKH: align post insert RLS with the role composer and make post visibility deterministic.
-- Customers can publish general, marketplace and car posts from the UI.
-- Beauty vendors can publish marketplace posts from the product composer.

drop policy if exists posts_insert on public.posts;

create policy posts_insert
on public.posts
for insert
to authenticated
with check (
  author_id = (select auth.uid())
  and (
    (select is_admin())
    or (exists(
      select 1 from public.user_roles ur
      where ur.user_id=(select auth.uid()) and ur.is_active and ur.role='restaurant_vendor'
    ) and post_type in ('food','marketplace'))
    or (exists(
      select 1 from public.user_roles ur
      where ur.user_id=(select auth.uid()) and ur.is_active and ur.role='supermarket_vendor'
    ) and post_type='marketplace')
    or (exists(
      select 1 from public.user_roles ur
      where ur.user_id=(select auth.uid()) and ur.is_active and ur.role='fashion_vendor'
    ) and post_type='fashion')
    or (exists(
      select 1 from public.user_roles ur
      where ur.user_id=(select auth.uid()) and ur.is_active and ur.role='vendor'
    ) and post_type='marketplace')
    or (exists(
      select 1 from public.user_roles ur
      where ur.user_id=(select auth.uid()) and ur.is_active and ur.role='electronics_vendor'
    ) and post_type='marketplace')
    or (exists(
      select 1 from public.user_roles ur
      where ur.user_id=(select auth.uid()) and ur.is_active and ur.role='jewelry_vendor'
    ) and post_type='marketplace')
    or (exists(
      select 1 from public.user_roles ur
      where ur.user_id=(select auth.uid()) and ur.is_active and ur.role='beauty_vendor'
    ) and post_type in ('marketplace','beauty'))
    or (exists(
      select 1 from public.user_roles ur
      where ur.user_id=(select auth.uid()) and ur.is_active and ur.role='car_dealer'
    ) and post_type='car')
    or (exists(
      select 1 from public.user_roles ur
      where ur.user_id=(select auth.uid()) and ur.is_active and ur.role='umrah_agency'
    ) and post_type='umrah')
    or (exists(
      select 1 from public.user_roles ur
      where ur.user_id=(select auth.uid()) and ur.is_active and ur.role='captain'
    ) and post_type='delivery')
    or (exists(
      select 1 from public.user_roles ur
      where ur.user_id=(select auth.uid()) and ur.is_active and ur.role='support'
    ) and post_type in ('support','announcement'))
    or (exists(
      select 1 from public.user_roles ur
      where ur.user_id=(select auth.uid()) and ur.is_active and ur.role='customer'
    ) and post_type in ('general','marketplace','car'))
  )
);

drop policy if exists posts_public on public.posts;

create policy posts_public
on public.posts
for select
to authenticated
using (
  (archived_at is null and status='approved' and visibility='public')
  or author_id=(select auth.uid())
  or is_admin()
);