-- Отдел сотрудника (null = нет ограничений по отделу)
alter table public.profiles
  add column if not exists department text
  check (department in ('studio', 'aho', 'office'));

-- Вспомогательная функция: отдел текущего пользователя
create or replace function public.current_user_department()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select department from public.profiles where id = auth.uid()
$$;

-- Обновляем RLS на equipment: INSERT разрешён только в свой отдел
drop policy if exists "equipment_insert" on public.equipment;
create policy "equipment_insert" on public.equipment
  for insert to authenticated
  with check (
    public.current_user_role() in ('admin', 'operator')
    and (
      public.current_user_department() is null
      or department = public.current_user_department()
    )
  );

-- Обновляем RLS на equipment: UPDATE разрешён только для своего отдела
drop policy if exists "equipment_update" on public.equipment;
create policy "equipment_update" on public.equipment
  for update to authenticated
  using (
    public.current_user_role() in ('admin', 'operator')
    and (
      public.current_user_department() is null
      or department = public.current_user_department()
    )
  );
