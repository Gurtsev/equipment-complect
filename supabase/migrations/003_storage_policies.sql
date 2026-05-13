-- Политики для Storage bucket equipment-images
-- SELECT уже открыт (Public bucket)

create policy "storage_insert"
on storage.objects for insert
to authenticated
with check (bucket_id = 'equipment-images');

create policy "storage_update"
on storage.objects for update
to authenticated
using (bucket_id = 'equipment-images');

create policy "storage_delete"
on storage.objects for delete
to authenticated
using (bucket_id = 'equipment-images');
