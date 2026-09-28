-- Harden Storage uploads so authenticated users can only upload inside their own user folder.
-- Existing application upload paths already use <user_id>/..., so this preserves current upload flows
-- while preventing authenticated users from writing arbitrary object paths.

drop policy if exists "storage_auth_insert" on storage.objects;

create policy "storage_auth_insert"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = any (array['avatars','posts','products','businesses']::text[])
  and (select auth.uid()) is not null
  and (storage.foldername(name))[1] = (select auth.uid()::text)
);
