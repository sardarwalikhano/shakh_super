create table if not exists public.user_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  theme text not null default 'system' check (theme in ('system','light','dark')),
  order_notifications boolean not null default true,
  delivery_notifications boolean not null default true,
  marketing_notifications boolean not null default true,
  updated_at timestamptz not null default now()
);

alter table public.user_preferences enable row level security;

drop policy if exists user_preferences_self_select on public.user_preferences;
create policy user_preferences_self_select on public.user_preferences
for select to authenticated
using (user_id=(select auth.uid()) or is_admin());

drop policy if exists user_preferences_self_insert on public.user_preferences;
create policy user_preferences_self_insert on public.user_preferences
for insert to authenticated
with check (user_id=(select auth.uid()) or is_admin());

drop policy if exists user_preferences_self_update on public.user_preferences;
create policy user_preferences_self_update on public.user_preferences
for update to authenticated
using (user_id=(select auth.uid()) or is_admin())
with check (user_id=(select auth.uid()) or is_admin());

alter table public.platform_settings
  add column if not exists platform_fee_iqd numeric not null default 250,
  add column if not exists support_phone text not null default '07504796924',
  add column if not exists support_whatsapp text not null default '07504796924',
  add column if not exists default_city text not null default 'هەولێر',
  add column if not exists privacy_policy_version text not null default '1.0';

update public.platform_settings
set platform_fee_iqd=coalesce(platform_fee_iqd,250),
    support_phone=coalesce(nullif(support_phone,''),'07504796924'),
    support_whatsapp=coalesce(nullif(support_whatsapp,''),'07504796924'),
    default_city=coalesce(nullif(default_city,''),'هەولێر'),
    privacy_policy_version=coalesce(nullif(privacy_policy_version,''),'1.0')
where id=true;
