-- Профили пользователей (расширяет auth.users)
create table if not exists inventory.profiles (
  id   uuid references auth.users(id) on delete cascade primary key,
  name text not null,
  role text not null check (role in ('admin', 'operator', 'viewer'))
);

-- Вспомогательная функция: роль текущего пользователя
create or replace function inventory.current_user_role()
returns text
language sql
stable
security definer
as $$
  select role from inventory.profiles where id = auth.uid()
$$;

-- ─── RLS ────────────────────────────────────────────────────────────────────

alter table inventory.profiles        enable row level security;
alter table inventory.equipment       enable row level security;
alter table inventory.equipment_history enable row level security;
alter table inventory.projects        enable row level security;
alter table inventory.project_equipment enable row level security;

-- profiles: каждый видит только свой профиль
create policy "profiles_select" on inventory.profiles
  for select to authenticated using (id = auth.uid());

-- equipment
create policy "equipment_select" on inventory.equipment
  for select to authenticated using (true);

create policy "equipment_insert" on inventory.equipment
  for insert to authenticated
  with check (inventory.current_user_role() in ('admin', 'operator'));

create policy "equipment_update" on inventory.equipment
  for update to authenticated
  using (inventory.current_user_role() in ('admin', 'operator'));

create policy "equipment_delete" on inventory.equipment
  for delete to authenticated
  using (inventory.current_user_role() = 'admin');

-- equipment_history
create policy "history_select" on inventory.equipment_history
  for select to authenticated using (true);

create policy "history_insert" on inventory.equipment_history
  for insert to authenticated
  with check (inventory.current_user_role() in ('admin', 'operator'));

-- projects
create policy "projects_select" on inventory.projects
  for select to authenticated using (true);

create policy "projects_insert" on inventory.projects
  for insert to authenticated
  with check (inventory.current_user_role() in ('admin', 'operator'));

create policy "projects_update" on inventory.projects
  for update to authenticated
  using (inventory.current_user_role() in ('admin', 'operator'));

create policy "projects_delete" on inventory.projects
  for delete to authenticated
  using (inventory.current_user_role() = 'admin');

-- project_equipment
create policy "pe_select" on inventory.project_equipment
  for select to authenticated using (true);

create policy "pe_insert" on inventory.project_equipment
  for insert to authenticated
  with check (inventory.current_user_role() in ('admin', 'operator'));

create policy "pe_delete" on inventory.project_equipment
  for delete to authenticated
  using (inventory.current_user_role() in ('admin', 'operator'));
