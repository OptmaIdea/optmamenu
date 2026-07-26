drop policy if exists "Authenticated Delete Reward Images" on storage.objects;

create policy "Authenticated Delete Reward Images"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'reward-images'
  and public.is_store_member(((storage.foldername(name))[1])::uuid)
);
