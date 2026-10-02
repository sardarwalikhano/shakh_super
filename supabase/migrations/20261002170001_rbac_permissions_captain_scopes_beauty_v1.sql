alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles add constraint profiles_role_check check (role = any (array['super_admin','admin','customer','vendor','restaurant_vendor','supermarket_vendor','fashion_vendor','captain','support','car_dealer','umrah_agency','jewelry_vendor','electronics_vendor','beauty_vendor']));

alter table public.stores drop constraint if exists stores_category_check;
alter table public.stores add constraint stores_category_check check (category = any (array['restaurant','supermarket','fashion','daily','marketplace','jewelry','electronics','beauty']));

create table if not exists public.permissions (
 key text primary key, label_ku text not null, description_ku text, created_at timestamptz not null default now()
);
create table if not exists public.role_permissions (
 role public.app_role not null, permission_key text not null references public.permissions(key) on delete cascade,
 created_at timestamptz not null default now(), primary key(role,permission_key)
);
create table if not exists public.user_permissions (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
 permission_key text not null references public.permissions(key) on delete cascade, is_allowed boolean not null default true,
 granted_by uuid references auth.users(id) on delete set null, created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(), unique(user_id,permission_key)
);
create table if not exists public.captain_delivery_zones (
 captain_id uuid not null references auth.users(id) on delete cascade,
 delivery_zone_id uuid not null references public.delivery_zones(id) on delete cascade,
 assigned_by uuid references auth.users(id) on delete set null, created_at timestamptz not null default now(),
 primary key(captain_id,delivery_zone_id)
);
create index if not exists idx_user_permissions_user on public.user_permissions(user_id);
create index if not exists idx_user_permissions_key on public.user_permissions(permission_key);
create index if not exists idx_captain_delivery_zones_captain on public.captain_delivery_zones(captain_id);
create index if not exists idx_captain_delivery_zones_zone on public.captain_delivery_zones(delivery_zone_id);

alter table public.permissions enable row level security;
alter table public.role_permissions enable row level security;
alter table public.user_permissions enable row level security;
alter table public.captain_delivery_zones enable row level security;

create or replace function private.is_super_admin()
returns boolean language sql stable security definer set search_path to ''
as $$ select exists(select 1 from public.user_roles where user_id=(select auth.uid()) and role='super_admin'::public.app_role and is_active=true); $$;

create or replace function private.has_permission(p_permission text)
returns boolean language sql stable security definer set search_path to ''
as $$
select (select auth.uid()) is not null and (
 private.is_super_admin()
 or exists(select 1 from public.user_roles ur join public.role_permissions rp on rp.role=ur.role where ur.user_id=(select auth.uid()) and ur.is_active=true and rp.permission_key=p_permission)
 or exists(select 1 from public.user_permissions up where up.user_id=(select auth.uid()) and up.permission_key=p_permission and up.is_allowed=true)
);
$$;

revoke all on function private.is_super_admin() from public,anon;
grant execute on function private.is_super_admin() to authenticated;
revoke all on function private.has_permission(text) from public,anon;
grant execute on function private.has_permission(text) to authenticated;

create policy permissions_select_authenticated on public.permissions for select to authenticated using (true);
create policy role_permissions_select_authenticated on public.role_permissions for select to authenticated using (true);
create policy user_permissions_select_self_or_super on public.user_permissions for select to authenticated using (user_id=(select auth.uid()) or private.is_super_admin());
create policy user_permissions_manage_super on public.user_permissions for all to authenticated using (private.is_super_admin()) with check (private.is_super_admin());
create policy captain_delivery_zones_select_scope on public.captain_delivery_zones for select to authenticated using (captain_id=(select auth.uid()) or private.is_super_admin() or private.has_permission('captain.zone.manage'));
create policy captain_delivery_zones_manage on public.captain_delivery_zones for all to authenticated using (private.is_super_admin() or private.has_permission('captain.zone.manage')) with check (private.is_super_admin() or private.has_permission('captain.zone.manage'));

insert into public.permissions(key,label_ku,description_ku) values
('dashboard.read','بینینی داشبۆرد','بینینی داشبۆرد و پوختەی هەژمار'),
('posts.create','دروستکردنی پۆست','دروستکردن و ناردنی پۆست'),
('posts.manage.own','بەڕێوەبردنی پۆستی خۆی','دەستکاری و بەڕێوەبردنی پۆستەکانی خۆی'),
('posts.moderate','چاودێری پۆست','پەسەندکردن، ڕاگرتن و moderation'),
('orders.read','بینینی ئۆردەر','بینینی ئۆردەرە پەیوەندیدارەکان'),
('orders.manage','بەڕێوەبردنی ئۆردەر','گۆڕینی دۆخی ئۆردەر بە پێی دەسەڵات'),
('captain.zone.manage','بەڕێوەبردنی سنوری کاپتن','دانانی ناوچە بۆ کاپتن'),
('wallet.read','بینینی جزدان','بینینی باڵانس و مامەڵە'),
('referral.manage','بەڕێوەبردنی قازانج','بەڕێوەبردنی قازانجی پۆست و withdrawal'),
('support.manage','بەڕێوەبردنی پشتگیری','بەڕێوەبردنی تیکەتەکانی پشتگیری'),
('settings.manage','بەڕێوەبردنی ڕێکخستن','گۆڕینی ڕێکخستنە پێدراوەکانی پلاتفۆرم')
on conflict(key) do update set label_ku=excluded.label_ku,description_ku=excluded.description_ku;

insert into public.role_permissions(role,permission_key)
select v.role::public.app_role,v.permission_key from (values
('customer','dashboard.read'),('customer','posts.create'),('customer','posts.manage.own'),('customer','orders.read'),('customer','wallet.read'),
('vendor','dashboard.read'),('vendor','posts.create'),('vendor','posts.manage.own'),('vendor','orders.read'),('vendor','wallet.read'),
('restaurant_vendor','dashboard.read'),('restaurant_vendor','posts.create'),('restaurant_vendor','posts.manage.own'),('restaurant_vendor','orders.read'),('restaurant_vendor','wallet.read'),
('supermarket_vendor','dashboard.read'),('supermarket_vendor','posts.create'),('supermarket_vendor','posts.manage.own'),('supermarket_vendor','orders.read'),('supermarket_vendor','wallet.read'),
('fashion_vendor','dashboard.read'),('fashion_vendor','posts.create'),('fashion_vendor','posts.manage.own'),('fashion_vendor','orders.read'),('fashion_vendor','wallet.read'),
('electronics_vendor','dashboard.read'),('electronics_vendor','posts.create'),('electronics_vendor','posts.manage.own'),('electronics_vendor','orders.read'),('electronics_vendor','wallet.read'),
('jewelry_vendor','dashboard.read'),('jewelry_vendor','posts.create'),('jewelry_vendor','posts.manage.own'),('jewelry_vendor','orders.read'),('jewelry_vendor','wallet.read'),
('beauty_vendor','dashboard.read'),('beauty_vendor','posts.create'),('beauty_vendor','posts.manage.own'),('beauty_vendor','orders.read'),('beauty_vendor','wallet.read'),
('captain','dashboard.read'),('captain','orders.read'),('captain','wallet.read'),
('car_dealer','dashboard.read'),('car_dealer','posts.create'),('car_dealer','posts.manage.own'),('car_dealer','orders.read'),('car_dealer','wallet.read'),
('umrah_agency','dashboard.read'),('umrah_agency','posts.create'),('umrah_agency','posts.manage.own'),('umrah_agency','orders.read'),('umrah_agency','wallet.read'),
('support','dashboard.read'),('support','support.manage')
) v(role,permission_key)
join public.permissions p on p.key=v.permission_key
on conflict do nothing;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path to 'public'
as $function$
declare requested_role text; safe_role text; accepted_at timestamptz; accepted_version text;
begin
 requested_role:=lower(coalesce(new.raw_user_meta_data->>'role','customer'));
 accepted_at:=nullif(new.raw_user_meta_data->>'privacy_policy_accepted_at','')::timestamptz;
 accepted_version:=nullif(new.raw_user_meta_data->>'privacy_policy_version','');
 safe_role:=case requested_role
  when 'customer' then 'customer' when 'vendor' then 'vendor' when 'restaurant_vendor' then 'restaurant_vendor'
  when 'supermarket_vendor' then 'supermarket_vendor' when 'fashion_vendor' then 'fashion_vendor'
  when 'jewelry_vendor' then 'jewelry_vendor' when 'electronics_vendor' then 'electronics_vendor'
  when 'beauty_vendor' then 'beauty_vendor' when 'captain' then 'captain' when 'car_dealer' then 'car_dealer'
  when 'umrah_agency' then 'umrah_agency' else 'customer' end;
 insert into public.profiles(id,full_name,email,role,privacy_policy_accepted_at,privacy_policy_version)
 values(new.id,coalesce(new.raw_user_meta_data->>'full_name',new.raw_user_meta_data->>'name'),new.email,safe_role,accepted_at,accepted_version)
 on conflict(id) do update set full_name=excluded.full_name,email=excluded.email,
 role=case when public.profiles.role in ('super_admin','admin') then public.profiles.role else excluded.role end,
 privacy_policy_accepted_at=coalesce(public.profiles.privacy_policy_accepted_at,excluded.privacy_policy_accepted_at),
 privacy_policy_version=coalesce(public.profiles.privacy_policy_version,excluded.privacy_policy_version),updated_at=now();
 insert into public.user_roles(user_id,role) values(new.id,safe_role::public.app_role) on conflict do nothing;
 insert into public.wallets(user_id) values(new.id) on conflict(user_id) do nothing;
 if safe_role='captain' then insert into public.captains(user_id,is_online) values(new.id,false) on conflict(user_id) do nothing; end if;
 return new;
end;
$function$;

create or replace function public.prepare_post_role_metadata()
returns trigger language plpgsql set search_path to 'public'
as $function$
declare resolved_role text; trusted_db_context boolean:=auth.uid() is null and current_user in ('postgres','supabase_admin');
begin
 if trusted_db_context then resolved_role:=coalesce(new.publisher_role,'super_admin');
 else
  resolved_role:=public.current_user_role();
  if resolved_role is null then raise exception 'A valid active role is required to create or update a post'; end if;
  if new.author_id<>auth.uid() and not public.is_admin() then raise exception 'You can only create or update your own posts'; end if;
 end if;
 if new.post_type is null or new.post_type='' then
  new.post_type:=case resolved_role
   when 'restaurant_vendor' then 'food' when 'supermarket_vendor' then 'food' when 'fashion_vendor' then 'fashion'
   when 'car_dealer' then 'car' when 'umrah_agency' then 'umrah' when 'captain' then 'delivery'
   when 'beauty_vendor' then 'beauty' when 'admin' then 'announcement' when 'super_admin' then 'announcement'
   else 'marketplace' end;
 end if;
 if not trusted_db_context and not public.is_admin() then
  if resolved_role='restaurant_vendor' and new.post_type<>'food' then raise exception 'Restaurant vendors can only publish food posts'; end if;
  if resolved_role='supermarket_vendor' and new.post_type<>'food' then raise exception 'Supermarket vendors can only publish food posts'; end if;
  if resolved_role='fashion_vendor' and new.post_type<>'fashion' then raise exception 'Fashion vendors can only publish fashion posts'; end if;
  if resolved_role='car_dealer' and new.post_type<>'car' then raise exception 'Car dealers can only publish car posts'; end if;
  if resolved_role='umrah_agency' and new.post_type<>'umrah' then raise exception 'Umrah agencies can only publish Umrah posts'; end if;
  if resolved_role='captain' and new.post_type<>'delivery' then raise exception 'Captains can only publish delivery posts'; end if;
  if resolved_role='beauty_vendor' and new.post_type<>'beauty' then raise exception 'Beauty vendors can only publish beauty posts'; end if;
  if resolved_role='customer' and new.post_type not in ('general','marketplace','car') then raise exception 'Customers can only publish general, marketplace or car posts'; end if;
 end if;
 if resolved_role not in ('super_admin','admin','customer','vendor','restaurant_vendor','supermarket_vendor','fashion_vendor','captain','support','car_dealer','umrah_agency','jewelry_vendor','electronics_vendor','beauty_vendor') then raise exception 'Invalid publishing role'; end if;
 new.publisher_role:=resolved_role;
 new.label:=case
  when resolved_role='restaurant_vendor' then 'خواردنگە' when resolved_role='supermarket_vendor' then 'سووپەرمارکێت'
  when resolved_role='fashion_vendor' then 'جلوبەرگ' when resolved_role='electronics_vendor' then 'ئەلیکترۆنیات'
  when resolved_role='jewelry_vendor' then 'جواکاری' when resolved_role='beauty_vendor' then 'جوانکاری'
  when resolved_role='vendor' then 'بازاڕ' when resolved_role='car_dealer' then 'ئۆتۆمبێل'
  when resolved_role='umrah_agency' then 'عومرە' when resolved_role='captain' then 'گەیاندن'
  when resolved_role in ('admin','super_admin') and new.post_type='support' then 'پشتگیری'
  when resolved_role in ('admin','super_admin') then 'ئاگاداری'
  when new.post_type='food' then 'خواردنگە' when new.post_type='fashion' then 'جلوبەرگ'
  when new.post_type='car' then 'ئۆتۆمبێل' when new.post_type='beauty' then 'جوانکاری'
  when new.post_type='umrah' then 'عومرە' when new.post_type='delivery' then 'گەیاندن'
  when new.post_type='marketplace' then 'بازاڕ' when new.post_type='announcement' then 'ئاگاداری'
  when new.post_type='support' then 'پشتگیری' else 'گشتی' end;
 new.updated_at:=now(); return new;
end;
$function$;

create or replace function private.captain_can_serve_order(p_order_id uuid)
returns boolean language sql stable security definer set search_path to ''
as $$
select exists(
 select 1 from public.orders o
 join public.delivery_addresses a on a.id=o.address_id
 join public.captains c on c.user_id=(select auth.uid()) and c.is_online=true
 where o.id=p_order_id
 and exists(select 1 from public.user_roles ur where ur.user_id=(select auth.uid()) and ur.role='captain'::public.app_role and ur.is_active=true)
 and (
  not exists(select 1 from public.captain_delivery_zones cz where cz.captain_id=(select auth.uid()))
  or exists(
   select 1 from public.captain_delivery_zones cz join public.delivery_zones z on z.id=cz.delivery_zone_id
   where cz.captain_id=(select auth.uid()) and z.is_active=true
   and (z.city is null or a.city is null or z.city=a.city)
   and public.delivery_zone_contains_point(z.points,a.latitude,a.longitude)
  )
 )
);
$$;

revoke all on function private.captain_can_serve_order(uuid) from public,anon;
grant execute on function private.captain_can_serve_order(uuid) to authenticated;

create or replace function private.claim_order(p_order_id uuid)
returns boolean language plpgsql security definer set search_path to ''
as $function$
declare v_user uuid:=auth.uid(); v_updated integer;
begin
 if v_user is null then raise exception 'unauthorized'; end if;
 if not exists(select 1 from public.user_roles where user_id=v_user and role='captain'::public.app_role and is_active=true) then raise exception 'captain role required'; end if;
 if not exists(select 1 from public.captains where user_id=v_user and is_online=true) then raise exception 'captain must be online'; end if;
 if not private.captain_can_serve_order(p_order_id) then raise exception 'captain_service_zone_required'; end if;
 update public.orders set captain_id=v_user,status='assigned_to_captain'::public.order_status,updated_at=now()
 where id=p_order_id and captain_id is null and status='ready_for_pickup'::public.order_status;
 get diagnostics v_updated=row_count; return v_updated=1;
end;
$function$;

revoke all on function private.claim_order(uuid) from public,anon;
grant execute on function private.claim_order(uuid) to authenticated,service_role;