-- SHAKH: complete role insert policy and hide non-public posts from public feed
drop policy if exists posts_insert on public.posts;
create policy posts_insert on public.posts
for insert to authenticated
with check (
  author_id = auth.uid()
  and (
    public.is_admin()
    or public.current_user_role() = 'restaurant_vendor' and post_type = 'food'
    or public.current_user_role() = 'supermarket_vendor' and post_type = 'marketplace'
    or public.current_user_role() = 'fashion_vendor' and post_type = 'fashion'
    or public.current_user_role() = 'vendor' and post_type = 'marketplace'
    or public.current_user_role() = 'electronics_vendor' and post_type = 'marketplace'
    or public.current_user_role() = 'jewelry_vendor' and post_type = 'marketplace'
    or public.current_user_role() = 'car_dealer' and post_type = 'car'
    or public.current_user_role() = 'umrah_agency' and post_type = 'umrah'
    or public.current_user_role() = 'captain' and post_type = 'delivery'
    or public.current_user_role() = 'customer' and post_type in ('general','marketplace')
  )
);

drop policy if exists posts_public on public.posts;
create policy posts_public on public.posts
for select to public
using (
  (status = 'approved' and visibility = 'public')
  or author_id = auth.uid()
  or public.is_admin()
);
