-- user_id в истории оборудования
alter table public.equipment_history
  add column if not exists user_id uuid references auth.users(id) on delete set null;

-- Триггер: автоматически заполняем user_id из сессии при INSERT
create or replace function public.set_history_user_id()
returns trigger
language plpgsql
as $$
begin
  if new.user_id is null then
    new.user_id := auth.uid();
  end if;
  return new;
end;
$$;

drop trigger if exists set_history_user_id on public.equipment_history;
create trigger set_history_user_id
  before insert on public.equipment_history
  for each row execute function public.set_history_user_id();

-- Все аутентифицированные видят все профили (нужно для отображения имён в истории)
drop policy if exists "profiles_select" on public.profiles;
create policy "profiles_select" on public.profiles
  for select to authenticated using (true);
