-- Shakh delivery zones + captain location visibility notification
create table if not exists public.delivery_zones (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  store_id uuid references public.stores(id) on delete cascade,
  name text not null,
  city text,
  points jsonb not null default '[]'::jsonb,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint delivery_zones_points_array check (jsonb_typeof(points) = 'array'),
  constraint delivery_zones_min_points check (jsonb_array_length(points) >= 3)
);

create index if not exists idx_delivery_zones_store_active on public.delivery_zones(store_id,is_active);
create index if not exists idx_delivery_zones_owner on public.delivery_zones(owner_id);
create index if not exists idx_delivery_zones_city on public.delivery_zones(city);

alter table public.delivery_zones enable row level security;

drop policy if exists delivery_zones_select_public on public.delivery_zones;
create policy delivery_zones_select_public on public.delivery_zones for select to authenticated using (is_active = true or owner_id = (select auth.uid()) or is_admin());

drop policy if exists delivery_zones_insert_owner on public.delivery_zones;
create policy delivery_zones_insert_owner on public.delivery_zones for insert to authenticated with check (
  owner_id = (select auth.uid()) and (
    is_admin() or (
      store_id is not null and exists (select 1 from public.stores s where s.id = delivery_zones.store_id and s.owner_id = (select auth.uid()))
    )
  )
);

drop policy if exists delivery_zones_update_owner on public.delivery_zones;
create policy delivery_zones_update_owner on public.delivery_zones for update to authenticated
using (owner_id = (select auth.uid()) or is_admin())
with check (
  (owner_id = (select auth.uid()) and (
    is_admin() or (
      store_id is not null and exists (select 1 from public.stores s where s.id = delivery_zones.store_id and s.owner_id = (select auth.uid()))
    )
  )) or is_admin()
);

drop policy if exists delivery_zones_delete_owner on public.delivery_zones;
create policy delivery_zones_delete_owner on public.delivery_zones for delete to authenticated using (owner_id = (select auth.uid()) or is_admin());

create or replace function public.delivery_zone_contains_point(p_points jsonb,p_latitude double precision,p_longitude double precision)
returns boolean language plpgsql immutable strict as $function$
declare
  n integer; i integer; j integer; a jsonb; b jsonb;
  xi double precision; yi double precision; xj double precision; yj double precision;
  inside boolean := false;
begin
  if jsonb_typeof(p_points) <> 'array' then return false; end if;
  n := jsonb_array_length(p_points);
  if n < 3 then return false; end if;
  for i in 0..(n - 1) loop
    j := case when i = 0 then n - 1 else i - 1 end;
    a := p_points->i; b := p_points->j;
    xi := nullif(a->>'longitude','')::double precision;
    yi := nullif(a->>'latitude','')::double precision;
    xj := nullif(b->>'longitude','')::double precision;
    yj := nullif(b->>'latitude','')::double precision;
    if xi is null or yi is null or xj is null or yj is null then return false; end if;
    if ((yi > p_latitude) is distinct from (yj > p_latitude))
       and (p_longitude < (xj - xi) * (p_latitude - yi) / nullif(yj - yi,0) + xi) then
      inside := not inside;
    end if;
  end loop;
  return inside;
end;
$function$;

create or replace function public.address_within_delivery_zone(p_store_id uuid,p_address_id uuid)
returns boolean language plpgsql stable security definer set search_path to 'public' as $function$
declare
  v_lat double precision; v_lon double precision; v_store_zone_count integer; v_global_zone_count integer;
begin
  select latitude,longitude into v_lat,v_lon from public.delivery_addresses where id=p_address_id;
  select count(*) into v_store_zone_count from public.delivery_zones z where z.store_id=p_store_id and z.is_active=true;
  select count(*) into v_global_zone_count from public.delivery_zones z where z.store_id is null and z.is_active=true;
  if v_store_zone_count=0 and v_global_zone_count=0 then return true; end if;
  if v_lat is null or v_lon is null then return false; end if;
  if v_store_zone_count>0 then
    return exists(select 1 from public.delivery_zones z where z.store_id=p_store_id and z.is_active=true and public.delivery_zone_contains_point(z.points,v_lat,v_lon));
  end if;
  return exists(select 1 from public.delivery_zones z where z.store_id is null and z.is_active=true and public.delivery_zone_contains_point(z.points,v_lat,v_lon));
end;
$function$;

revoke all on function public.delivery_zone_contains_point(jsonb,double precision,double precision) from public,anon,authenticated;
grant execute on function public.delivery_zone_contains_point(jsonb,double precision,double precision) to authenticated;
revoke all on function public.address_within_delivery_zone(uuid,uuid) from public,anon,authenticated;
grant execute on function public.address_within_delivery_zone(uuid,uuid) to authenticated;

create or replace function public.validate_order_delivery_zone()
returns trigger language plpgsql security definer set search_path to 'public' as $function$
begin
  if new.address_id is not null and not public.address_within_delivery_zone(new.store_id,new.address_id) then
    raise exception 'DELIVERY_OUTSIDE_SERVICE_AREA' using errcode='P0001',detail='The selected delivery address is outside the active delivery zone.';
  end if;
  return new;
end;
$function$;

drop trigger if exists trg_validate_order_delivery_zone on public.orders;
create trigger trg_validate_order_delivery_zone before insert on public.orders for each row execute function public.validate_order_delivery_zone();

create or replace function public.handle_order_status_change()
returns trigger language plpgsql security definer set search_path to 'public' as $function$
declare
  status_title text; status_body text; store_owner uuid;
begin
  if tg_op='INSERT' or new.status is distinct from old.status or new.captain_id is distinct from old.captain_id then
    status_title := case new.status
      when 'pending' then 'داواکارییەکەت تۆمار کرا'
      when 'accepted' then 'داواکارییەکەت قبوڵ کرا'
      when 'preparing' then 'داواکارییەکەت ئامادە دەکرێت'
      when 'ready_for_pickup' then 'داواکارییەکە ئامادەی وەرگرتنە'
      when 'assigned_to_captain' then 'کاپتن بۆ داواکارییەکەت دیاریکرا'
      when 'picked_up' then 'کاپتن داواکارییەکەی وەرگرت'
      when 'on_the_way' then 'داواکارییەکەت لە ڕێگادایە'
      when 'delivered' then 'داواکارییەکەت گەیەندرا'
      when 'cancelled' then 'داواکارییەکەت هەڵوەشێنرایەوە'
      else 'دۆخی داواکاری نوێکرایەوە' end;

    status_body := case new.status
      when 'pending' then 'داواکارییەکەت بە سەرکەوتوویی تۆمار کرا و لە چاوەڕوانییە.'
      when 'accepted' then 'دوکان داواکارییەکەی قبوڵ کرد.'
      when 'preparing' then 'دوکان دەستی بە ئامادەکردنی داواکارییەکە کردووە.'
      when 'ready_for_pickup' then 'داواکارییەکە ئامادەی وەرگرتنە.'
      when 'assigned_to_captain' then 'کاپتنێک بۆ گەیاندنی داواکارییەکەت دیاریکرا.'
      when 'picked_up' then 'کاپتن داواکارییەکەی لە دوکان وەرگرت.'
      when 'on_the_way' then 'کاپتن لە ڕێگای گەیاندنی داواکارییەکەتە.'
      when 'delivered' then 'داواکارییەکەت بە سەرکەوتوویی گەیەندرا.'
      when 'cancelled' then 'داواکارییەکەت هەڵوەشێنرایەوە.'
      else 'دۆخی داواکارییەکەت نوێ کرایەوە.' end;

    if tg_op='INSERT' or new.status is distinct from old.status then
      insert into public.order_status_history(order_id,status,changed_by) values(new.id,new.status,auth.uid());
    end if;

    if new.customer_id is not null and (tg_op='INSERT' or new.status is distinct from old.status) then
      insert into public.notifications(user_id,title,body,type,is_read,data)
      values(new.customer_id,status_title,status_body,'order_status',false,jsonb_build_object('order_id',new.id,'status',new.status));
    end if;

    if new.captain_id is not null and (tg_op='INSERT' or new.captain_id is distinct from old.captain_id or new.status is distinct from old.status) then
      if new.captain_id is distinct from new.customer_id then
        insert into public.notifications(user_id,title,body,type,is_read,data)
        values(new.captain_id,'نوێکردنەوەی گەیاندن',status_body,'delivery',false,jsonb_build_object('order_id',new.id,'status',new.status));
      end if;
    end if;

    if new.captain_id is not null and new.captain_id is distinct from old.captain_id and new.status='assigned_to_captain' then
      if new.captain_id is distinct from new.customer_id then
        insert into public.notifications(user_id,title,body,type,is_read,data)
        values(new.customer_id,'شوێنی گەیاندنەکەت بۆ کاپتن دەرکرا','کاپتن بۆ ئەم ئۆردەرە دیاریکراوە و دەتوانێت شوێنی گەیاندنەکەت ببینێت بۆ ئەوەی گەیاندن بە دروستی ئەنجام بدات.','location_privacy',false,jsonb_build_object('order_id',new.id,'captain_id',new.captain_id,'status',new.status));
      end if;
    end if;

    select s.owner_id into store_owner from public.stores s where s.id=new.store_id;
    if store_owner is not null and (tg_op='INSERT' or new.status is distinct from old.status) then
      if store_owner is distinct from new.customer_id and store_owner is distinct from new.captain_id then
        insert into public.notifications(user_id,title,body,type,is_read,data)
        values(store_owner,'نوێکردنەوەی ئۆردەر',status_body,'vendor_order',false,jsonb_build_object('order_id',new.id,'status',new.status));
      end if;
    end if;
  end if;
  return new;
end;
$function$;