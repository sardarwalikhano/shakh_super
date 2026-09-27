-- SHAKH Posts: role-aware post types and labels
-- Backward-compatible: additive only; preserves existing post records.

alter table public.posts
  add column if not exists post_type text,
  add column if not exists publisher_role text,
  add column if not exists label text,
  add column if not exists rejection_reason text,
  add column if not exists visibility text not null default 'public';

update public.posts
set post_type = coalesce(post_type, section, 'general'),
    publisher_role = coalesce(publisher_role, 'customer'),
    label = coalesce(label, case coalesce(section, 'general')
      when 'food' then 'خواردنگە'
      when 'fashion' then 'جلوبەرگ'
      when 'car' then 'ئۆتۆمبێل'
      when 'umrah' then 'عومرە'
      when 'delivery' then 'گەیاندن'
      when 'marketplace' then 'بازاڕ'
      else 'گشتی'
    end)
where post_type is null or publisher_role is null or label is null;

alter table public.posts drop constraint if exists posts_post_type_check;
alter table public.posts add constraint posts_post_type_check
  check (post_type is null or post_type in ('general','marketplace','food','fashion','car','umrah','delivery','announcement','support'));

alter table public.posts drop constraint if exists posts_visibility_check;
alter table public.posts add constraint posts_visibility_check
  check (visibility in ('public','private','hidden'));

create index if not exists idx_posts_post_type on public.posts(post_type);
create index if not exists idx_posts_publisher_role on public.posts(publisher_role);
create index if not exists idx_posts_status_created_at on public.posts(status, created_at desc);
create index if not exists idx_posts_store_id on public.posts(store_id);

create or replace function public.prepare_post_role_metadata()
returns trigger language plpgsql security invoker set search_path = public
as $$
declare resolved_role text;
begin
  resolved_role := public.current_user_role();
  if resolved_role is null then raise exception 'A valid active role is required to create or update a post'; end if;
  if new.author_id <> auth.uid() and not public.is_admin() then raise exception 'You can only create or update your own posts'; end if;

  if new.post_type is null or new.post_type = '' then
    new.post_type := case resolved_role
      when 'restaurant_vendor' then 'food'
      when 'fashion_vendor' then 'fashion'
      when 'car_dealer' then 'car'
      when 'umrah_agency' then 'umrah'
      when 'captain' then 'delivery'
      else 'marketplace'
    end;
  end if;

  if not public.is_admin() then
    if resolved_role = 'restaurant_vendor' and new.post_type <> 'food' then raise exception 'Restaurant vendors can only publish food posts'; end if;
    if resolved_role = 'fashion_vendor' and new.post_type <> 'fashion' then raise exception 'Fashion vendors can only publish fashion posts'; end if;
    if resolved_role = 'car_dealer' and new.post_type <> 'car' then raise exception 'Car dealers can only publish car posts'; end if;
    if resolved_role = 'umrah_agency' and new.post_type <> 'umrah' then raise exception 'Umrah agencies can only publish Umrah posts'; end if;
    if resolved_role = 'captain' and new.post_type <> 'delivery' then raise exception 'Captains can only publish delivery posts'; end if;
    if resolved_role = 'customer' and new.post_type not in ('general','marketplace') then raise exception 'Customers can only publish general or marketplace posts'; end if;
  end if;

  new.publisher_role := resolved_role;
  new.label := case new.post_type
    when 'food' then 'خواردنگە'
    when 'fashion' then 'جلوبەرگ'
    when 'car' then 'ئۆتۆمبێل'
    when 'umrah' then 'عومرە'
    when 'delivery' then 'گەیاندن'
    when 'marketplace' then 'بازاڕ'
    when 'announcement' then 'ئاگاداری'
    when 'support' then 'پشتگیری'
    else 'گشتی'
  end;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_prepare_post_role_metadata on public.posts;
create trigger trg_prepare_post_role_metadata
before insert or update of author_id, post_type, title, content, images, price_iqd, city, status, section, publisher_name, visibility
on public.posts for each row execute function public.prepare_post_role_metadata();

drop policy if exists posts_insert on public.posts;
drop policy if exists posts_insert_super_admin on public.posts;
create policy posts_insert on public.posts for insert to authenticated
with check (
  author_id = auth.uid() and (
    public.is_admin()
    or (public.current_user_role() = 'restaurant_vendor' and post_type = 'food')
    or (public.current_user_role() = 'fashion_vendor' and post_type = 'fashion')
    or (public.current_user_role() = 'car_dealer' and post_type = 'car')
    or (public.current_user_role() = 'umrah_agency' and post_type = 'umrah')
    or (public.current_user_role() = 'captain' and post_type = 'delivery')
    or (public.current_user_role() = 'customer' and post_type in ('general','marketplace'))
  )
);

drop policy if exists posts_update on public.posts;
create policy posts_update on public.posts for update to authenticated
using (author_id = auth.uid() or public.is_admin())
with check (author_id = auth.uid() or public.is_admin());
