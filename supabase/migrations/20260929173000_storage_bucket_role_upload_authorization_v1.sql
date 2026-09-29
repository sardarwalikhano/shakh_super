-- SHAKH Stage 11: storage upload authorization by bucket and role.

DROP POLICY IF EXISTS storage_auth_insert ON storage.objects;

CREATE POLICY storage_auth_insert
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  (bucket_id = 'avatars' AND (storage.foldername(name))[1] = ((select auth.uid())::text))
  OR
  (bucket_id = 'posts' AND (storage.foldername(name))[1] = ((select auth.uid())::text))
  OR
  (bucket_id = 'businesses' AND (storage.foldername(name))[1] = ((select auth.uid())::text))
  OR
  (
    bucket_id = 'products'
    AND (storage.foldername(name))[1] = ((select auth.uid())::text)
    AND public.current_user_role() = ANY (ARRAY[
      'super_admin','admin','vendor','restaurant_vendor',
      'supermarket_vendor','fashion_vendor','electronics_vendor','jewelry_vendor'
    ])
  )
);
