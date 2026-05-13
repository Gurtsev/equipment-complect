-- Профили пользователей (расширяет auth.users)
create table if not exists public.profiles (
  id   uuid references auth.users(id) on delete cascade primary key,
  name text not null,
  role text not null check (role in ('admin', 'operator', 'viewer'))
);

-- Вспомогательная функция: роль текущего пользователя
create or replace function public.current_user_role()
returns text
language sql
stable
security definer
as $$
  select role from public.profiles where id = auth.uid()
$$;

-- ─── RLS ────────────────────────────────────────────────────────────────────

alter table public.profiles        enable row level security;
alter table public.equipment       enable row level security;
alter table public.equipment_history enable row level security;
alter table public.projects        enable row level security;
alter table public.project_equipment enable row level security;

-- profiles: каждый видит только свой профиль
create policy "profiles_select" on public.profiles
  for select to authenticated using (id = auth.uid());

-- equipment
create policy "equipment_select" on public.equipment
  for select to authenticated using (true);

create policy "equipment_insert" on public.equipment
  for insert to authenticated
  with check (public.current_user_role() in ('admin', 'operator'));

create policy "equipment_update" on public.equipment
  for update to authenticated
  using (public.current_user_role() in ('admin', 'operator'));

create policy "equipment_delete" on public.equipment
  for delete to authenticated
  using (public.current_user_role() = 'admin');

-- equipment_history
create policy "history_select" on public.equipment_history
  for select to authenticated using (true);

create policy "history_insert" on public.equipment_history
  for insert to authenticated
  with check (public.current_user_role() in ('admin', 'operator'));

-- projects
create policy "projects_select" on public.projects
  for select to authenticated using (true);

create policy "projects_insert" on public.projects
  for insert to authenticated
  with check (public.current_user_role() in ('admin', 'operator'));

create policy "projects_update" on public.projects
  for update to authenticated
  using (public.current_user_role() in ('admin', 'operator'));

create policy "projects_delete" on public.projects
  for delete to authenticated
  using (public.current_user_role() = 'admin');

-- project_equipment
create policy "pe_select" on public.project_equipment
  for select to authenticated using (true);

create policy "pe_insert" on public.project_equipment
  for insert to authenticated
  with check (public.current_user_role() in ('admin', 'operator'));

create policy "pe_delete" on public.project_equipment
  for delete to authenticated
  using (public.current_user_role() in ('admin', 'operator'));
