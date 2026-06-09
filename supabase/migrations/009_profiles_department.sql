-- Отдел сотрудника (null = нет ограничений по отделу)
alter table inventory.profiles
  add column if not exists department text
  check (department in ('studio', 'aho', 'office'));

-- Вспомогательная функция: отдел текущего пользователя
create or replace function inventory.current_user_department()
returns text
language sql
stable
security definer
set search_path = inventory, public
as $$
  select department from inventory.profiles where id = auth.uid()
$$;

-- Обновляем RLS на equipment: INSERT разрешён только в свой отдел
drop policy if exists "equipment_insert" on inventory.equipment;
create policy "equipment_insert" on inventory.equipment
  for insert to authenticated
  with check (
    inventory.current_user_role() in ('admin', 'operator')
    and (
      inventory.current_user_department() is null
      or department = inventory.current_user_department()
    )
  );

-- Обновляем RLS на equipment: UPDATE разрешён только для своего отдела
drop policy if exists "equipment_update" on inventory.equipment;
create policy "equipment_update" on inventory.equipment
  for update to authenticated
  using (
    inventory.current_user_role() in ('admin', 'operator')
    and (
      inventory.current_user_department() is null
      or department = inventory.current_user_department()
    )
  );
