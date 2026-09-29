create schema if not exists private;

create table if not exists private.posts_delete_archive (
  archive_id uuid primary key default gen_random_uuid(),
  post_id uuid not null,
  deleted_at timestamptz not null default now(),
  deleted_by uuid null,
  post_row jsonb not null
);

revoke all on private.posts_delete_archive from public, anon, authenticated;

create or replace function private.archive_deleted_post()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
begin
  insert into private.posts_delete_archive (post_id, deleted_by, post_row)
  values (old.id, auth.uid(), to_jsonb(old));
  return old;
end;
$$;

revoke all on function private.archive_deleted_post() from public, anon, authenticated;

drop trigger if exists trg_archive_deleted_post on public.posts;
create trigger trg_archive_deleted_post
before delete on public.posts
for each row execute function private.archive_deleted_post();
