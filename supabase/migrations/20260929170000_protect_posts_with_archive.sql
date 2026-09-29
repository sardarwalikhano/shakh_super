alter table public.posts add column if not exists archived_at timestamptz;
create index if not exists idx_posts_archived_at on public.posts(archived_at);
drop policy if exists posts_public on public.posts;
create policy posts_public on public.posts
for select to authenticated
using (
  archived_at is null
  and (
    (status='approved' and visibility='public')
    or author_id=(select auth.uid())
    or is_admin()
  )
);