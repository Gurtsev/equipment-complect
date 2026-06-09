create table inventory.project_history (
  id             uuid default gen_random_uuid() primary key,
  project_id     text not null references inventory.projects(id) on delete cascade,
  user_id        uuid references auth.users(id) on delete set null,
  action         text not null check (action in (
    'equipment_added', 'equipment_removed', 'activated', 'finished', 'created', 'updated'
  )),
  equipment_id   text,
  equipment_name text,
  recorded_at    timestamptz default now()
);

-- Автоматически заполняем user_id из сессии
create or replace function inventory.set_project_history_user_id()
returns trigger language plpgsql as $$
begin
  if new.user_id is null then
    new.user_id := auth.uid();
  end if;
  return new;
end;
$$;

drop trigger if exists set_project_history_user_id on inventory.project_history;
create trigger set_project_history_user_id
  before insert on inventory.project_history
  for each row execute function inventory.set_project_history_user_id();

alter table inventory.project_history enable row level security;

create policy "ph_select" on inventory.project_history
  for select to authenticated using (true);

create policy "ph_insert" on inventory.project_history
  for insert to authenticated
  with check (inventory.current_user_role() in ('admin', 'operator'));

-- Добавить в realtime
alter publication supabase_realtime add table inventory.project_history;
