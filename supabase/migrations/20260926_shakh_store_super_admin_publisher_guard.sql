-- SHAKH Store: only Super Admin can publish under the platform publisher name
create or replace function public.enforce_shakh_store_publisher()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  is_super_admin_user boolean;
begin
  if new.publisher_name = 'SHAKH Store' then
    select exists(
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.role = 'super_admin'
    ) into is_super_admin_user;

    if not is_super_admin_user then
      raise exception 'Only Super Admin can publish as SHAKH Store';
    end if;

    new.publisher_name := 'SHAKH Store';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_enforce_shakh_store_publisher on public.posts;
create trigger trg_enforce_shakh_store_publisher
before insert or update on public.posts
for each row
execute function public.enforce_shakh_store_publisher();
