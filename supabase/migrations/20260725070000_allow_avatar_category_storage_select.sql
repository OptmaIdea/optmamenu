drop policy if exists user_avatars_select_own_or_manager on storage.objects;
create policy user_avatars_select_own_or_manager
on storage.objects
for select
to authenticated
using (
  bucket_id = 'user-avatars'
  and (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  and public.can_manage_user_avatar(((storage.foldername(name))[1])::uuid)
);

drop policy if exists category_images_select_authenticated on storage.objects;
create policy category_images_select_authenticated
on storage.objects
for select
to authenticated
using (bucket_id = 'category-images');
