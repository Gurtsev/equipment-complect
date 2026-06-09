create table inventory.employee_assignments (
  id           uuid default gen_random_uuid() primary key,
  equipment_id text not null references inventory.equipment(id) on delete cascade,
  profile_id   uuid not null references inventory.profiles(id) on delete cascade,
  assigned_at  timestamptz default now(),
  returned_at  timestamptz,
  assigned_by  uuid references auth.users(id) on delete set null,
  notes        text
);

-- Автоматически записываем кто выдал
create or replace function inventory.set_assignment_assigned_by()
returns trigger language plpgsql as $$
begin
  if new.assigned_by is null then
    new.assigned_by := auth.uid();
  end if;
  return new;
end;
$$;

drop trigger if exists set_assignment_assigned_by on inventory.employee_assignments;
create trigger set_assignment_assigned_by
  before insert on inventory.employee_assignments
  for each row execute function inventory.set_assignment_assigned_by();

alter table inventory.employee_assignments enable row level security;

create policy "ea_select" on inventory.employee_assignments
  for select to authenticated using (true);

create policy "ea_insert" on inventory.employee_assignments
  for insert to authenticated
  with check (inventory.current_user_role() in ('admin', 'operator'));

create policy "ea_update" on inventory.employee_assignments
  for update to authenticated
  using (inventory.current_user_role() in ('admin', 'operator'));

alter publication supabase_realtime add table inventory.employee_assignments;
