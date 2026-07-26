drop policy if exists "Authenticated Select Reward Images" on storage.objects;

create policy "Authenticated Select Reward Images"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'reward-images'
  and is_store_member(((storage.foldername(name))[1])::uuid)
);
