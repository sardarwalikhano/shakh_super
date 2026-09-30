-- SHAKH: persist which admin last changed platform settings.
-- Fixes SettingsPanel updates that reference platform_settings.updated_by.

begin;

alter table public.platform_settings
  add column if not exists updated_by uuid references public.profiles(id) on delete set null;

create index if not exists idx_platform_settings_updated_by
  on public.platform_settings(updated_by);

commit;
