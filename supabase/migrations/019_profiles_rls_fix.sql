-- Аудит безопасности 4.11, пункт 1: profiles_select разрешал любому
-- authenticated читать email и роли всех пользователей (using (true), миграция 005).
-- Сужаем до своей записи или admin; для отображения имён в истории — отдельная view без email/role.

create or replace view inventory.profile_names as
  select id, name from inventory.profiles;

grant select on inventory.profile_names to authenticated;

drop policy if exists "profiles_select" on inventory.profiles;
create policy "profiles_select" on inventory.profiles
  for select to authenticated using (
    id = auth.uid() or inventory.current_user_role() = 'admin'
  );
