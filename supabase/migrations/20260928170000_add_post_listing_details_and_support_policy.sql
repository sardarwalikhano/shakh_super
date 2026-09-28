alter table public.posts
  add column if not exists listing_details jsonb not null default '{}'::jsonb;

create index if not exists posts_post_type_idx on public.posts(post_type);
create index if not exists posts_publisher_role_idx on public.posts(publisher_role);
create index if not exists posts_listing_details_gin_idx on public.posts using gin(listing_details);

drop policy if exists posts_insert on public.posts;
create policy posts_insert
  on public.posts
  for insert
  to authenticated
  with check (
    author_id = (select auth.uid())
    and (
      (select is_admin())
      or ((select current_user_role()) = 'restaurant_vendor' and post_type in ('food','marketplace'))
      or ((select current_user_role()) = 'supermarket_vendor' and post_type = 'marketplace')
      or ((select current_user_role()) = 'fashion_vendor' and post_type = 'fashion')
      or ((select current_user_role()) = 'vendor' and post_type = 'marketplace')
      or ((select current_user_role()) = 'electronics_vendor' and post_type = 'marketplace')
      or ((select current_user_role()) = 'jewelry_vendor' and post_type = 'marketplace')
      or ((select current_user_role()) = 'car_dealer' and post_type = 'car')
      or ((select current_user_role()) = 'umrah_agency' and post_type = 'umrah')
      or ((select current_user_role()) = 'captain' and post_type = 'delivery')
      or ((select current_user_role()) = 'support' and post_type in ('support','announcement'))
      or ((select current_user_role()) = 'customer' and post_type in ('general','marketplace'))
    )
  );