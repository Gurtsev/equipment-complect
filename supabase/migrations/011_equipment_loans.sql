-- Временные займы оборудования (сотруднику или в отдел)
create table public.equipment_loans (
  id uuid primary key default gen_random_uuid(),
  equipment_id text not null references public.equipment(id) on delete cascade,
  loan_type text not null check (loan_type in ('employee', 'department')),
  to_profile_id uuid references public.profiles(id),
  to_department text check (to_department in ('studio', 'aho', 'office')),
  from_department text not null check (from_department in ('studio', 'aho', 'office')),
  project_id text references public.projects(id),
  issued_by uuid references auth.users(id),
  issued_at timestamptz not null default now(),
  due_date date,
  returned_at timestamptz,
  notes text,
  check (
    (loan_type = 'employee' and to_profile_id is not null and to_department is null) or
    (loan_type = 'department' and to_department is not null and to_profile_id is null)
  )
);

-- BEFORE INSERT: заполнить issued_by
create or replace function public.set_loan_issued_by()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  new.issued_by := auth.uid();
  return new;
end;
$$;

create trigger loan_issued_by_trigger
before insert on public.equipment_loans
for each row execute function public.set_loan_issued_by();

-- RLS
alter table public.equipment_loans enable row level security;

create policy "loans_select" on public.equipment_loans
  for select to authenticated using (true);

create policy "loans_insert" on public.equipment_loans
  for insert to authenticated
  with check (public.current_user_role() in ('admin', 'operator'));

create policy "loans_update" on public.equipment_loans
  for update to authenticated
  using (public.current_user_role() in ('admin', 'operator'));

-- Realtime
alter publication supabase_realtime add table public.equipment_loans;
