-- SHAKH: allow post owners and admins to delete their posts
-- Backward-compatible: adds only the missing DELETE policy.

drop policy if exists posts_delete on public.posts;

create policy posts_delete
on public.posts
for delete
to authenticated
using (
  author_id = auth.uid()
  or public.is_admin()
);
