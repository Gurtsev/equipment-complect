create table public.employee_assignments (
  id           uuid default gen_random_uuid() primary key,
  equipment_id text not null references public.equipment(id) on delete cascade,
  profile_id   uuid not null references public.profiles(id) on delete cascade,
  assigned_at  timestamptz default now(),
  returned_at  timestamptz,
  assigned_by  uuid references auth.users(id) on delete set null,
  notes        text
);

-- Автоматически записываем кто выдал
create or replace function public.set_assignment_assigned_by()
returns trigger language plpgsql as $$
begin
  if new.assigned_by is null then
    new.assigned_by := auth.uid();
  end if;
  return new;
end;
$$;

drop trigger if exists set_assignment_assigned_by on public.employee_assignments;
create trigger set_assignment_assigned_by
  before insert on public.employee_assignments
  for each row execute function public.set_assignment_assigned_by();

alter table public.employee_assignments enable row level security;

create policy "ea_select" on public.employee_assignments
  for select to authenticated using (true);

create policy "ea_insert" on public.employee_assignments
  for insert to authenticated
  with check (public.current_user_role() in ('admin', 'operator'));

create policy "ea_update" on public.employee_assignments
  for update to authenticated
  using (public.current_user_role() in ('admin', 'operator'));

alter publication supabase_realtime add table public.employee_assignments;
