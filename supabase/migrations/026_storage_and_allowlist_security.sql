-- Security hardening 4.11:
-- 1. Viewer больше не может создавать, заменять и удалять изображения.
-- 2. Список разрешённых email/доменов читает только admin.

drop policy if exists "storage_insert" on storage.objects;
create policy "storage_insert"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'equipment-images'
  and inventory.current_user_role() in ('admin', 'operator')
);

drop policy if exists "storage_update" on storage.objects;
create policy "storage_update"
on storage.objects for update
to authenticated
using (
  bucket_id = 'equipment-images'
  and inventory.current_user_role() in ('admin', 'operator')
)
with check (
  bucket_id = 'equipment-images'
  and inventory.current_user_role() in ('admin', 'operator')
);

drop policy if exists "storage_delete" on storage.objects;
create policy "storage_delete"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'equipment-images'
  and inventory.current_user_role() in ('admin', 'operator')
);

drop policy if exists "allowed_emails_select" on inventory.allowed_emails;
create policy "allowed_emails_select" on inventory.allowed_emails
  for select to authenticated
  using (inventory.current_user_role() = 'admin');

