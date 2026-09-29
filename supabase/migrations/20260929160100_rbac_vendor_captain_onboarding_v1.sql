-- SHAKH RBAC hardening for vendor/captain writes and captain onboarding.

drop policy if exists stores_insert_owner_admin on public.stores;
drop policy if exists stores_update_owner_admin on public.stores;
drop policy if exists stores_delete_owner_admin on public.stores;

create policy stores_insert_owner_vendor_admin
on public.stores
for insert
to authenticated
with check (
  owner_id = (select auth.uid())
  and (
    (select is_admin())
    or exists (
      select 1 from public.user_roles ur
      where ur.user_id = (select auth.uid())
        and ur.is_active = true
        and ur.role in (
          'vendor'::public.app_role,
          'restaurant_vendor'::public.app_role,
          'supermarket_vendor'::public.app_role,
          'fashion_vendor'::public.app_role,
          'electronics_vendor'::public.app_role,
          'jewelry_vendor'::public.app_role
        )
    )
  )
);

create policy stores_update_owner_vendor_admin
on public.stores
for update
to authenticated
using (
  (select is_admin())
  or (
    owner_id = (select auth.uid())
    and exists (
      select 1 from public.user_roles ur
      where ur.user_id = (select auth.uid())
        and ur.is_active = true
        and ur.role in (
          'vendor'::public.app_role,
          'restaurant_vendor'::public.app_role,
          'supermarket_vendor'::public.app_role,
          'fashion_vendor'::public.app_role,
          'electronics_vendor'::public.app_role,
          'jewelry_vendor'::public.app_role
        )
    )
  )
)
with check (
  (select is_admin())
  or (
    owner_id = (select auth.uid())
    and exists (
      select 1 from public.user_roles ur
      where ur.user_id = (select auth.uid())
        and ur.is_active = true
        and ur.role in (
          'vendor'::public.app_role,
          'restaurant_vendor'::public.app_role,
          'supermarket_vendor'::public.app_role,
          'fashion_vendor'::public.app_role,
          'electronics_vendor'::public.app_role,
          'jewelry_vendor'::public.app_role
        )
    )
  )
);

create policy stores_delete_owner_vendor_admin
on public.stores
for delete
to authenticated
using (
  (select is_admin())
  or (
    owner_id = (select auth.uid())
    and exists (
      select 1 from public.user_roles ur
      where ur.user_id = (select auth.uid())
        and ur.is_active = true
        and ur.role in (
          'vendor'::public.app_role,
          'restaurant_vendor'::public.app_role,
          'supermarket_vendor'::public.app_role,
          'fashion_vendor'::public.app_role,
          'electronics_vendor'::public.app_role,
          'jewelry_vendor'::public.app_role
        )
    )
  )
);

drop policy if exists products_manage_owner_admin on public.products;

create policy products_manage_owner_vendor_admin
on public.products
for all
to authenticated
using (
  (select is_admin())
  or exists (
    select 1
    from public.stores s
    where s.id = products.store_id
      and s.owner_id = (select auth.uid())
      and exists (
        select 1 from public.user_roles ur
        where ur.user_id = (select auth.uid())
          and ur.is_active = true
          and ur.role in (
            'vendor'::public.app_role,
            'restaurant_vendor'::public.app_role,
            'supermarket_vendor'::public.app_role,
            'fashion_vendor'::public.app_role,
            'electronics_vendor'::public.app_role,
            'jewelry_vendor'::public.app_role
          )
      )
  )
)
with check (
  (select is_admin())
  or exists (
    select 1
    from public.stores s
    where s.id = products.store_id
      and s.owner_id = (select auth.uid())
      and exists (
        select 1 from public.user_roles ur
        where ur.user_id = (select auth.uid())
          and ur.is_active = true
          and ur.role in (
            'vendor'::public.app_role,
            'restaurant_vendor'::public.app_role,
            'supermarket_vendor'::public.app_role,
            'fashion_vendor'::public.app_role,
            'electronics_vendor'::public.app_role,
            'jewelry_vendor'::public.app_role
          )
      )
  )
);

drop policy if exists promotions_owner on public.promotions;

create policy promotions_owner_vendor_admin
on public.promotions
for all
to authenticated
using (
  (select is_admin())
  or exists (
    select 1
    from public.stores s
    where s.id = promotions.store_id
      and s.owner_id = (select auth.uid())
      and exists (
        select 1 from public.user_roles ur
        where ur.user_id = (select auth.uid())
          and ur.is_active = true
          and ur.role in (
            'vendor'::public.app_role,
            'restaurant_vendor'::public.app_role,
            'supermarket_vendor'::public.app_role,
            'fashion_vendor'::public.app_role,
            'electronics_vendor'::public.app_role,
            'jewelry_vendor'::public.app_role
          )
      )
  )
)
with check (
  (select is_admin())
  or exists (
    select 1
    from public.stores s
    where s.id = promotions.store_id
      and s.owner_id = (select auth.uid())
      and exists (
        select 1 from public.user_roles ur
        where ur.user_id = (select auth.uid())
          and ur.is_active = true
          and ur.role in (
            'vendor'::public.app_role,
            'restaurant_vendor'::public.app_role,
            'supermarket_vendor'::public.app_role,
            'fashion_vendor'::public.app_role,
            'electronics_vendor'::public.app_role,
            'jewelry_vendor'::public.app_role
          )
      )
  )
);

drop policy if exists captain_self on public.captains;

create policy captain_self_role_restricted
on public.captains
for all
to authenticated
using (
  (select is_admin())
  or (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.user_roles ur
      where ur.user_id = (select auth.uid())
        and ur.is_active = true
        and ur.role = 'captain'::public.app_role
    )
  )
)
with check (
  (select is_admin())
  or (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.user_roles ur
      where ur.user_id = (select auth.uid())
        and ur.is_active = true
        and ur.role = 'captain'::public.app_role
    )
  )
);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $function$
declare
  requested_role text;
  safe_role text;
  accepted_at timestamptz;
  accepted_version text;
begin
  requested_role := lower(coalesce(new.raw_user_meta_data->>'role', 'customer'));
  accepted_at := nullif(new.raw_user_meta_data->>'privacy_policy_accepted_at', '')::timestamptz;
  accepted_version := nullif(new.raw_user_meta_data->>'privacy_policy_version', '');

  safe_role := case requested_role
    when 'customer' then 'customer'
    when 'vendor' then 'vendor'
    when 'restaurant_vendor' then 'restaurant_vendor'
    when 'supermarket_vendor' then 'supermarket_vendor'
    when 'fashion_vendor' then 'fashion_vendor'
    when 'jewelry_vendor' then 'jewelry_vendor'
    when 'electronics_vendor' then 'electronics_vendor'
    when 'captain' then 'captain'
    when 'car_dealer' then 'car_dealer'
    when 'umrah_agency' then 'umrah_agency'
    else 'customer'
  end;

  insert into public.profiles(
    id, full_name, email, role, privacy_policy_accepted_at, privacy_policy_version
  )
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name'),
    new.email,
    safe_role,
    accepted_at,
    accepted_version
  )
  on conflict(id) do update
    set full_name = excluded.full_name,
        email = excluded.email,
        role = case
          when public.profiles.role in ('super_admin','admin') then public.profiles.role
          else excluded.role
        end,
        privacy_policy_accepted_at = coalesce(public.profiles.privacy_policy_accepted_at, excluded.privacy_policy_accepted_at),
        privacy_policy_version = coalesce(public.profiles.privacy_policy_version, excluded.privacy_policy_version),
        updated_at = now();

  insert into public.user_roles(user_id, role)
  values (new.id, safe_role::public.app_role)
  on conflict do nothing;

  insert into public.wallets(user_id)
  values(new.id)
  on conflict(user_id) do nothing;

  if safe_role = 'captain' then
    insert into public.captains(user_id, is_online)
    values(new.id, false)
    on conflict (user_id) do nothing;
  end if;

  return new;
end;
$function$;
