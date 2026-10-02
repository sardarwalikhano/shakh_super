drop policy if exists posts_delete_archive_admin_select on private.posts_delete_archive;
create policy posts_delete_archive_admin_select on private.posts_delete_archive
for select to authenticated using (private.is_admin());