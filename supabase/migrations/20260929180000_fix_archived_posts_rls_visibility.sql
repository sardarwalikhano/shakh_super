drop policy if exists posts_public on public.posts;
create policy posts_public on public.posts
for select to authenticated
using (
  (archived_at is null and status='approved' and visibility='public')
  or author_id=(select auth.uid())
  or is_admin()
);