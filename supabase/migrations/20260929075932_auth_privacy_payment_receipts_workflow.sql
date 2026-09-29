-- Shakh production auth/privacy and posting-payment receipt workflow
alter table public.profiles
  add column if not exists privacy_policy_accepted_at timestamptz,
  add column if not exists privacy_policy_version text;

alter table public.vehicle_posting_payments
  add column if not exists receipt_url text;

alter table public.umrah_agencies
  add column if not exists posting_fee_iqd numeric not null default 0;

create table if not exists public.umrah_posting_payments (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.umrah_trips(id) on delete cascade,
  agency_id uuid not null references public.umrah_agencies(id) on delete cascade,
  payer_id uuid not null references auth.users(id) on delete cascade,
  amount_iqd numeric not null check (amount_iqd >= 0),
  payment_method text not null default 'cash',
  status text not null default 'submitted',
  receipt_url text,
  reference text,
  paid_at timestamptz,
  verified_at timestamptz,
  verified_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create index if not exists idx_umrah_posting_payments_trip on public.umrah_posting_payments(trip_id);
create index if not exists idx_umrah_posting_payments_agency on public.umrah_posting_payments(agency_id);
create index if not exists idx_umrah_posting_payments_status on public.umrah_posting_payments(status);

alter table public.umrah_posting_payments enable row level security;

drop policy if exists umrah_posting_payment_insert on public.umrah_posting_payments;
create policy umrah_posting_payment_insert
on public.umrah_posting_payments
for insert
to authenticated
with check (
  payer_id = (select auth.uid())
  and exists (
    select 1 from public.umrah_trips t
    where t.id = umrah_posting_payments.trip_id
      and t.agency_id = umrah_posting_payments.agency_id
      and exists (
        select 1 from public.umrah_agencies a
        where a.id = t.agency_id and a.owner_id = (select auth.uid())
      )
  )
);

drop policy if exists umrah_posting_payment_read on public.umrah_posting_payments;
create policy umrah_posting_payment_read
on public.umrah_posting_payments
for select
to authenticated
using (
  payer_id = (select auth.uid())
  or exists (
    select 1 from public.umrah_agencies a
    where a.id = umrah_posting_payments.agency_id
      and a.owner_id = (select auth.uid())
  )
  or current_user_role() in ('super_admin','admin')
);

drop policy if exists umrah_posting_payment_admin_update on public.umrah_posting_payments;
create policy umrah_posting_payment_admin_update
on public.umrah_posting_payments
for update
to authenticated
using (current_user_role() in ('super_admin','admin'))
with check (current_user_role() in ('super_admin','admin'));

insert into storage.buckets (id, name, public)
values ('payment-receipts', 'payment-receipts', false)
on conflict (id) do update set public = false;

drop policy if exists payment_receipts_insert on storage.objects;
create policy payment_receipts_insert
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'payment-receipts'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

drop policy if exists payment_receipts_select on storage.objects;
create policy payment_receipts_select
on storage.objects
for select
to authenticated
using (
  bucket_id = 'payment-receipts'
  and (
    (storage.foldername(name))[1] = (select auth.uid())::text
    or current_user_role() in ('super_admin','admin')
  )
);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path to 'public'
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
        privacy_policy_accepted_at = coalesce(
          public.profiles.privacy_policy_accepted_at,
          excluded.privacy_policy_accepted_at
        ),
        privacy_policy_version = coalesce(
          public.profiles.privacy_policy_version,
          excluded.privacy_policy_version
        ),
        updated_at = now();

  insert into public.user_roles(user_id, role)
  values (new.id, safe_role::public.app_role)
  on conflict do nothing;

  insert into public.wallets(user_id)
  values(new.id)
  on conflict(user_id) do nothing;

  return new;
end;
$function$;
